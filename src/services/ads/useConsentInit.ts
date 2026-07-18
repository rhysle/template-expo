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
        // Avoid invoking UMP while offline. Native iOS network errors are localized, so
        // matching their message in Sentry is not reliable across device languages.
        await assertOnline()

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
        // Record actionable production issues (for example, no GDPR form published), while
        // treating a confirmed offline state as expected rather than a Sentry error.
        if (!(await isOfflineConsentFailure(error))) {
          recordError(error, 'useConsentInit')
        }
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
