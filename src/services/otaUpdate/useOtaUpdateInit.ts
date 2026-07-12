import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState } from 'react-native'

import { AppConfig } from '@/configs'
import { setAnalyticsUserProperties, trackEvent } from '@/services/firebase/analytics'
import { AnalyticsGeneralEvents } from '@/services/firebase/analytics/analyticsGeneralEvents'
import { recordError, setSentryTag } from '@/services/sentry'
import { useOtaUpdateState } from '@/stores/features/otaUpdate'
import { useSnackbarState } from '@/stores/features/snackbar'
import { assertOnline } from '@/utils/network'
import { OfflineError } from '@/utils/OfflineError'

import {
  checkForUpdate,
  downloadUpdate,
  getCurrentOtaUpdateId,
  reloadApp,
} from './otaUpdateService'

const EXPECTED_UPDATE_CHECK_ERROR_PATTERNS = [
  /OTA update check timed out/i,
  /Call to function 'ExpoUpdates\.checkForUpdateAsync' has been rejected/i,
  /Failed to check for update/i,
]

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message?: unknown }
    if (typeof message === 'string') return message
  }
  return String(error)
}

const isExpectedUpdateCheckError = (error: unknown): boolean => {
  const message = getErrorMessage(error)
  return EXPECTED_UPDATE_CHECK_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

/**
 * One-time OTA update lifecycle hook. Call once inside RootLayoutContent
 * (inside I18nProvider so useTranslation resolves correctly).
 *
 * Responsibilities:
 *  1. Detect if a new OTA was applied since the last cold start → analytics + Sentry tag
 *  2. Check for updates on launch + every app foreground event
 *  3. Download silently; show a persistent snackbar with "Restart" action when ready
 */
export const useOtaUpdateInit = () => {
  const { t } = useTranslation()
  const { lastAppliedUpdateId, setLastAppliedUpdateId } = useOtaUpdateState()
  const { showSnackbar } = useSnackbarState()

  // Prevents concurrent check/download cycles
  const isCheckingRef = useRef(false)
  // Prevents re-checking after a successful download in the same session
  const hasDownloadedRef = useRef(false)
  // Prevents a fast double-tap on the "Restart" snackbar action from firing
  // reloadAsync (and the analytics event) twice. First tap wins.
  const hasTappedRestartRef = useRef(false)
  // Track last AppState so we only trigger on genuine background → foreground transitions
  const appStateRef = useRef(AppState.currentState)
  // Capture the persisted update ID at mount time so Effect 1 only reads the
  // cold-start value - not a moving target as the slice updates during the run
  const initialUpdateIdRef = useRef(lastAppliedUpdateId)

  // ── Effect 1: Detect if a new OTA was applied on this cold start ──────────
  // setLastAppliedUpdateId is a stable Zustand action - this runs once on mount
  useEffect(() => {
    if (__DEV__ || !AppConfig.otaUpdate.enabled) return

    const currentOtaUpdateId = getCurrentOtaUpdateId()

    // Tag only downloaded OTA launches. Embedded build IDs are not traceable
    // in EAS Update and should not be reported as OTA update IDs.
    if (currentOtaUpdateId) {
      setSentryTag('ota_update_id', currentOtaUpdateId)
      setAnalyticsUserProperties({ ota_update_id: currentOtaUpdateId })
    }

    // A new OTA was applied if the current ID differs from what we persisted last session
    if (currentOtaUpdateId && currentOtaUpdateId !== initialUpdateIdRef.current) {
      setLastAppliedUpdateId(currentOtaUpdateId)
      trackEvent(AnalyticsGeneralEvents.OTA_UPDATE_APPLIED, { update_id: currentOtaUpdateId })
    }
  }, [setLastAppliedUpdateId])

  // ── Effect 2: Check for updates on launch + app foreground ────────────────
  // showSnackbar and t are both stable references - this runs once on mount
  useEffect(() => {
    if (__DEV__ || !AppConfig.otaUpdate.enabled) return

    const performCheck = async () => {
      if (isCheckingRef.current || hasDownloadedRef.current) return
      isCheckingRef.current = true

      let didCompleteUpdateCheck = false

      try {
        // Skip the round-trip entirely when there is no internet. Without this
        // guard, every cold start / foreground in airplane mode would surface
        // a generic fetch error in Sentry, adding noise without signal.
        await assertOnline()

        const isAvailable = await checkForUpdate()
        didCompleteUpdateCheck = true
        if (isAvailable) {
          trackEvent(AnalyticsGeneralEvents.OTA_UPDATE_AVAILABLE)

          const isNew = await downloadUpdate()
          if (isNew) {
            hasDownloadedRef.current = true
            trackEvent(AnalyticsGeneralEvents.OTA_UPDATE_DOWNLOADED)

            showSnackbar({
              title: t('otaUpdate.updateReady'),
              variant: 'success',
              durationMs: 0, // persist until user acts
              action: {
                label: t('otaUpdate.restart'),
                onPress: () => {
                  // First tap wins. Reanalysis: reloadAsync terminates the JS
                  // thread, but a double-tap before that happens would fire
                  // the analytics event twice and skew funnel metrics.
                  if (hasTappedRestartRef.current) return
                  hasTappedRestartRef.current = true
                  trackEvent(AnalyticsGeneralEvents.OTA_UPDATE_RESTART)
                  void reloadApp().catch((error) => {
                    hasTappedRestartRef.current = false
                    recordError(error, 'useOtaUpdateInit reloadApp')
                  })
                },
              },
            })
          }
        }
      } catch (error) {
        // Offline is an expected state, not a bug - swallow silently rather
        // than burning Sentry quota on it. Expo's checkForUpdateAsync can also
        // reject or hang when connectivity changes after assertOnline(); that
        // is expected for an opportunistic background check. Download/reload
        // failures remain reportable because an update was already found.
        if (
          !(error instanceof OfflineError) &&
          (didCompleteUpdateCheck || !isExpectedUpdateCheckError(error))
        ) {
          recordError(error, 'useOtaUpdateInit performCheck')
        }
      } finally {
        isCheckingRef.current = false
      }
    }

    void performCheck()

    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current
      appStateRef.current = nextState
      if (prev !== 'active' && nextState === 'active') {
        void performCheck()
      }
    })

    return () => subscription.remove()
  }, [showSnackbar, t])
}
