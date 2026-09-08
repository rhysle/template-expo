import { useFoundationRuntime } from '@rhysle/mobile-foundation/runtime'
import { useAdsState } from '@rhysle/mobile-foundation/stores/features/ads'
import { useEffect } from 'react'

import { initMobileAds, isAnyAdFormatEnabled } from './adsService'

/**
 * Initializes the Google Mobile Ads SDK once ATT + UMP consent have resolved.
 *
 * Call this hook once inside the root layout component:
 *
 *   import { useAdsInit } from './enabled'
 *   // Inside RootLayout:
 *   useAdsInit()
 *
 * The hook waits for UMP to resolve and explicitly allow ad requests before calling
 * initialize(). When ads are disabled, setup:ads selects a no-native implementation through the
 * shared facade, so consumers keep the same call without bundling the SDK.
 */
export const useAdsInit = () => {
  const { config: appConfig } = useFoundationRuntime()
  const { adsInitialized, canRequestAds, consentGathered, setAdsInitialized, setAdsInitError } =
    useAdsState()

  useEffect(() => {
    if (!isAnyAdFormatEnabled(appConfig) || !consentGathered || !canRequestAds || adsInitialized)
      return

    let cancelled = false

    const initialize = async () => {
      try {
        await initMobileAds(appConfig)
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
  }, [
    appConfig,
    adsInitialized,
    canRequestAds,
    consentGathered,
    setAdsInitialized,
    setAdsInitError,
  ])
}
