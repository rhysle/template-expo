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
  isAdsEnabled,
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

// If AppConfig.ads.enabled is false, remove the call to this hook in
// src/app/(tabs)/_layout.tsx and run npm run setup:ads.
export const useConsentInit = () => {
  const { setCanRequestAds, setConsentGathered, setPrivacyOptionsRequired } = useAdsState()
  const { isSubscribed } = useSubscriptionState()

  useEffect(() => {
    // Subscribers see no ads - skip consent entirely.
    if (!isAdsEnabled() || isSubscribed) {
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
  }, [isSubscribed, setCanRequestAds, setConsentGathered, setPrivacyOptionsRequired])
}
