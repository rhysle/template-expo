import { useCallback, useEffect, useRef, useState } from 'react'

import { AppConfig } from '@/configs'
import { recordError } from '@/services/sentry'
import { useAdsState } from '@/stores/features/ads'
import { usePaywallState } from '@/stores/features/paywall'

import { AdEventType, getAdUnitId, InterstitialAd } from './adsService'
import { useCanShowAds } from './useCanShowAds'

export interface UseInterstitialAdOptions {
  /** Override the ad unit ID. Defaults to AppConfig interstitial unit for current platform. */
  unitId?: string
  /**
   * Automatically reload the ad after it closes.
   * @default true
   */
  autoReload?: boolean
}

export interface UseInterstitialAdReturn {
  /**
   * Show the interstitial ad if all conditions are met: ads enabled, user not subscribed,
   * grace period elapsed, cooldown elapsed, and ad loaded. Returns `true` if shown.
   */
  show: () => Promise<boolean>
  /** True once the ad has finished loading and is ready to display. */
  isLoaded: boolean
  /** True while the ad is visible on screen. */
  isShowing: boolean
  /** Error from the most recent load attempt, or null. */
  error: Error | null
}

export const useInterstitialAd = (
  options: UseInterstitialAdOptions = {}
): UseInterstitialAdReturn => {
  const { unitId, autoReload = true } = options
  const canShowAds = useCanShowAds()
  const { interstitialLastShownAt, interstitialSessionCount, recordInterstitialShown } =
    useAdsState()
  const { isAutoPaywallShowing } = usePaywallState()

  const isActive = canShowAds
  const { gracePeriodSessions, cooldownMs } = AppConfig.ads.interstitial

  const adRef = useRef<InterstitialAd | null>(null)

  const [isLoaded, setIsLoaded] = useState(false)
  const [isShowing, setIsShowing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!isActive) {
      adRef.current = null
      setIsLoaded(false)
      setIsShowing(false)
      return
    }

    const ad = InterstitialAd.createForAdRequest(unitId ?? getAdUnitId('interstitial'))
    adRef.current = ad

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      setIsLoaded(true)
      setError(null)
    })

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error: Error) => {
      setIsLoaded(false)
      setError(error)
    })

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setIsLoaded(false)
      setIsShowing(false)
      if (autoReload) ad.load()
    })

    ad.load()

    return () => {
      unsubLoaded()
      unsubError()
      unsubClosed()
      if (adRef.current === ad) adRef.current = null
    }
  }, [isActive, autoReload, unitId])

  const show = useCallback(async (): Promise<boolean> => {
    if (!isActive || !isLoaded) return false
    if (isAutoPaywallShowing) return false
    if (interstitialSessionCount < gracePeriodSessions) return false
    if (interstitialLastShownAt !== null && Date.now() - interstitialLastShownAt < cooldownMs)
      return false
    const ad = adRef.current
    if (!ad) return false
    setIsShowing(true)
    try {
      await ad.show()
      recordInterstitialShown()
      return true
    } catch (error) {
      setIsShowing(false)
      setError(error instanceof Error ? error : new Error(String(error)))
      recordError(error, 'useInterstitialAd.show')
      return false
    }
  }, [
    isActive,
    isLoaded,
    isAutoPaywallShowing,
    interstitialSessionCount,
    gracePeriodSessions,
    interstitialLastShownAt,
    cooldownMs,
    recordInterstitialShown,
  ])

  return { show, isLoaded, isShowing, error }
}
