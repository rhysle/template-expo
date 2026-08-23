import { useEffect } from 'react'

import { useAdsState } from '@/stores/features/ads'

import { initMobileAds, isAnyAdFormatEnabled } from './adsService'

/**
 * Initializes the Google Mobile Ads SDK once ATT + UMP consent have resolved.
 *
 * Call this hook once inside the root layout component:
 *
 *   import { useAdsInit } from '@/services/ads'
 *   // Inside RootLayout:
 *   useAdsInit()
 *
 * The hook waits for UMP to resolve and explicitly allow ad requests before calling
 * initialize(). When ads are disabled, setup:ads selects a no-native implementation through the
 * shared facade, so consumers keep the same call without bundling the SDK.
 */
export const useAdsInit = () => {
  const { adsInitialized, canRequestAds, consentGathered, setAdsInitialized, setAdsInitError } =
    useAdsState()

  useEffect(() => {
    if (!isAnyAdFormatEnabled() || !consentGathered || !canRequestAds || adsInitialized) return

    let cancelled = false

    const initialize = async () => {
      try {
        await initMobileAds()
        if (!cancelled) setAdsInitialized(true)
      } catch (error) {
        if (!cancelled) {
          setAdsInitError(error instanceof Error ? error.message : String(error))
        }
      }
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [adsInitialized, canRequestAds, consentGathered, setAdsInitialized, setAdsInitError])
}
