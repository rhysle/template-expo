import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency'
import { useEffect, useRef } from 'react'
import { AppState, InteractionManager, Platform } from 'react-native'

import { recordError } from '@/services/sentry'
import { useAdsState } from '@/stores/features/ads'
import { usePaywallState } from '@/stores/features/paywall'
import { useSubscriptionState } from '@/stores/features/subscription'
import { assertOnline } from '@/utils/network'
import { OfflineError } from '@/utils/OfflineError'

import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  isAnyAdFormatEnabled,
} from './adsService'

const isOfflineConsentFailure = async (error: unknown): Promise<boolean> => {
  if (error instanceof OfflineError) return true

  try {
    await assertOnline()
    return false
  } catch (networkError) {
    return networkError instanceof OfflineError
  }
}

type ConsentFailureStage =
  'gather_consent' | 'read_consent_choices' | 'read_consent_info' | 'request_tracking_permission'

interface ConsentFailure {
  error: unknown
  stage: ConsentFailureStage
}

const getConsentErrorDetails = (
  error: unknown,
  stage: ConsentFailureStage
): Record<string, unknown> => {
  const details: Record<string, unknown> = { stage }
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' || typeof code === 'number') details.code = code
  }
  return details
}

// setup:ads exports this implementation through the shared facade only when ads are enabled.
export const useConsentInit = () => {
  const { setCanRequestAds, setConsentGathered, setPrivacyOptionsRequired } = useAdsState()
  const { premiumState } = useSubscriptionState()
  const { isPaywallShowing } = usePaywallState()
  const consentCompleted = useRef(false)

  useEffect(() => {
    // Premium and unresolved users see no ads, so skip consent until access is confirmed free.
    if (!isAnyAdFormatEnabled() || premiumState !== 'free') {
      setCanRequestAds(false)
      setConsentGathered(true)
      return
    }

    if (consentCompleted.current || isPaywallShowing) return

    let cancelled = false
    let started = false
    let presentationTask: ReturnType<typeof InteractionManager.runAfterInteractions> | undefined

    const gather = async () => {
      const failures: ConsentFailure[] = []
      let gatheredSuccessfully = false

      try {
        // Avoid invoking UMP while offline. Native iOS network errors are localized, so
        // matching their message in Sentry is not reliable across device languages.
        await assertOnline()

        await AdsConsent.gatherConsent(
          __DEV__ ? { debugGeography: AdsConsentDebugGeography.EEA } : undefined
        )
        gatheredSuccessfully = true
      } catch (error) {
        failures.push({ error, stage: 'gather_consent' })
      }

      let info: Awaited<ReturnType<typeof AdsConsent.getConsentInfo>> | undefined
      try {
        // UMP may retain a valid choice from an earlier session even when the current
        // information update fails. Its canRequestAds result is the source of truth.
        info = await AdsConsent.getConsentInfo()
      } catch (error) {
        failures.push({ error, stage: 'read_consent_info' })
      }

      if (Platform.OS === 'ios' && info?.canRequestAds && gatheredSuccessfully) {
        let mayRequestTracking = false

        try {
          const gdprApplies = await AdsConsent.getGdprApplies()
          mayRequestTracking =
            !gdprApplies || (await AdsConsent.getPurposeConsents()).startsWith('1')
        } catch (error) {
          failures.push({ error, stage: 'read_consent_choices' })
        }

        if (mayRequestTracking) {
          try {
            const trackingPermission = await getTrackingPermissionsAsync()
            if (trackingPermission.status === PermissionStatus.UNDETERMINED) {
              // UMP's completion can coincide with its dismissal animation. Queue ATT behind all
              // active UI interactions so UIKit never receives overlapping presentation requests.
              await new Promise<void>((resolve) => {
                presentationTask = InteractionManager.runAfterInteractions(resolve)
              })

              if (!cancelled && !isPaywallShowing && AppState.currentState === 'active') {
                await requestTrackingPermissionsAsync()
              }
            }
          } catch (error) {
            failures.push({ error, stage: 'request_tracking_permission' })
          }
        }
      }

      if (info) {
        if (!cancelled) {
          setCanRequestAds(info.canRequestAds)
          setPrivacyOptionsRequired(
            info.privacyOptionsRequirementStatus ===
              AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
          )
        }
      } else if (!cancelled) {
        setCanRequestAds(false)
      }

      for (const failure of failures) {
        if (!(await isOfflineConsentFailure(failure.error))) {
          recordError(
            failure.error,
            `useConsentInit.${failure.stage}`,
            getConsentErrorDetails(failure.error, failure.stage)
          )
        }
      }

      if (!cancelled) {
        consentCompleted.current = true
        setConsentGathered(true)
      }
    }

    const scheduleGather = () => {
      if (cancelled || started || AppState.currentState !== 'active') return

      presentationTask?.cancel()
      presentationTask = InteractionManager.runAfterInteractions(() => {
        if (cancelled || isPaywallShowing) return
        started = true
        void gather()
      })
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') scheduleGather()
    })

    scheduleGather()

    return () => {
      cancelled = true
      presentationTask?.cancel()
      appStateSubscription.remove()
    }
  }, [
    isPaywallShowing,
    premiumState,
    setCanRequestAds,
    setConsentGathered,
    setPrivacyOptionsRequired,
  ])
}
