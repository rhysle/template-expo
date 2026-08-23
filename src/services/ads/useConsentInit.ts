import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import { recordError } from '@/services/sentry'
import { useAdsState } from '@/stores/features/ads'
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

// setup:ads exports this implementation through the shared facade only when ads are enabled.
export const useConsentInit = () => {
  const { setCanRequestAds, setConsentGathered, setPrivacyOptionsRequired } = useAdsState()
  const { premiumState } = useSubscriptionState()

  useEffect(() => {
    // Premium and unresolved users see no ads, so skip consent until access is confirmed free.
    if (!isAnyAdFormatEnabled() || premiumState !== 'free') {
      setCanRequestAds(false)
      setConsentGathered(true)
      return
    }

    let cancelled = false

    const gather = async () => {
      let consentError: unknown

      try {
        // Avoid invoking UMP while offline. Native iOS network errors are localized, so
        // matching their message in Sentry is not reliable across device languages.
        await assertOnline()

        await AdsConsent.gatherConsent(
          __DEV__ ? { debugGeography: AdsConsentDebugGeography.EEA } : undefined
        )
      } catch (error) {
        consentError = error
      }

      try {
        // UMP may retain a valid choice from an earlier session even when the current
        // information update fails. Its canRequestAds result is the source of truth.
        const info = await AdsConsent.getConsentInfo()

        if (Platform.OS === 'ios' && info.canRequestAds) {
          const gdprApplies = await AdsConsent.getGdprApplies()
          const mayRequestTracking =
            !gdprApplies || (await AdsConsent.getPurposeConsents()).startsWith('1')

          if (mayRequestTracking) {
            await requestTrackingPermissionsAsync()
          }
        }

        if (!cancelled) {
          setCanRequestAds(info.canRequestAds)
          setPrivacyOptionsRequired(
            info.privacyOptionsRequirementStatus ===
              AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
          )
        }
      } catch (error) {
        consentError ??= error
        if (!cancelled) setCanRequestAds(false)
      }

      if (consentError && !(await isOfflineConsentFailure(consentError))) {
        recordError(consentError, 'useConsentInit')
      }

      if (!cancelled) setConsentGathered(true)
    }

    void gather()
    return () => {
      cancelled = true
    }
  }, [premiumState, setCanRequestAds, setConsentGathered, setPrivacyOptionsRequired])
}
