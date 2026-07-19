import { useEffect } from 'react'

import { useAdsState } from '@/stores/features/ads'

import { initMobileAds, isAdsEnabled } from './adsService'

/**
 * Initializes the Google Mobile Ads SDK once ATT + UMP consent have resolved.
 *
 * Call this hook once inside the root layout component when ads are enabled:
 *
 *   import { useAdsInit } from '@/services/ads'
 *   // Inside RootLayout:
 *   useAdsInit()
 *
 * The hook waits for UMP to resolve and explicitly allow ad requests before calling
 * initialize(). If ads are disabled, the hook is a no-op.
 * When not using ads in a project, omit this call so Metro never bundles the package.
 */
export const useAdsInit = () => {
  const { adsInitialized, canRequestAds, consentGathered, setAdsInitialized, setAdsInitError } =
    useAdsState()

  useEffect(() => {
    if (!isAdsEnabled() || !consentGathered || !canRequestAds || adsInitialized) return

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
