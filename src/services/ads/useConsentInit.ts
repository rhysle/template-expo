import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import { recordError } from '@/services/sentry'
import { useAdsState } from '@/stores/features/ads'
import { useSubscriptionState } from '@/stores/features/subscription'

import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  isAdsEnabled,
} from './adsService'

// If AppConfig.ads.enabled is false, remove the call to this hook in
// src/app/(tabs)/_layout.tsx and run npm run setup:ads.
export const useConsentInit = () => {
  const { setConsentGathered, setPrivacyOptionsRequired } = useAdsState()
  const { isSubscribed } = useSubscriptionState()

  useEffect(() => {
    // Subscribers see no ads - skip consent entirely.
    if (!isAdsEnabled() || isSubscribed) {
      setConsentGathered(true)
      return
    }

    let cancelled = false

    const gather = async () => {
      try {
        if (Platform.OS === 'ios') {
          await requestTrackingPermissionsAsync()
        }

        await AdsConsent.gatherConsent(
          __DEV__ ? { debugGeography: AdsConsentDebugGeography.EEA } : undefined
        )

        const info = await AdsConsent.getConsentInfo()
        if (!cancelled) {
          setPrivacyOptionsRequired(
            info.privacyOptionsRequirementStatus ===
              AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
          )
        }
      } catch (error) {
        // Consent errors are non-fatal - ads still initialize with non-personalized targeting.
        // Record to Sentry so production issues (e.g. no GDPR form published, network errors)
        // remain visible without crashing the app.
        recordError(error, 'useConsentInit')
      } finally {
        if (!cancelled) setConsentGathered(true)
      }
    }

    void gather()
    return () => {
      cancelled = true
    }
  }, [isSubscribed, setConsentGathered, setPrivacyOptionsRequired])
}
