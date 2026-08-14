import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import { AppState } from 'react-native'

import { AppConfig } from '@/configs'
import { hasPaywallPrecedence } from '@/services/revenueCat'
import { recordError } from '@/services/sentry'
import { useAdsState } from '@/stores/features/ads'
import { usePaywallState } from '@/stores/features/paywall'
import { useSubscriptionState } from '@/stores/features/subscription'

import { AdEventType, getAdUnitId, InterstitialAd, isInterstitialAdsEnabled } from './adsService'
import { getInterstitialEligibility } from './interstitialPolicy'
import { useCanShowAds } from './useCanShowAds'

type RequestInterstitialAd = () => Promise<void>

const InterstitialAdContext = createContext<RequestInterstitialAd | null>(null)

interface InterstitialAdProviderProps extends PropsWithChildren {
  canPresent?: boolean
}

export const InterstitialAdProvider = ({
  canPresent = true,
  children,
}: InterstitialAdProviderProps) => {
  const canShowAds = useCanShowAds()
  const {
    interstitialAdPreventionSources,
    interstitialLastShownAt,
    interstitialQualifyingCompletionsSinceLastAd,
    interstitialShownThisForeground,
    recordInterstitialQualifyingCompletion,
    recordInterstitialShown,
    resetInterstitialForegroundCap,
  } = useAdsState()
  const { autoPaywallEnabledAt, autoPaywallLastShownAt, isPaywallShowing } = usePaywallState()
  const { premiumState } = useSubscriptionState()
  const appStateRef = useRef(AppState.currentState)
  const adRef = useRef<InterstitialAd | null>(null)
  // A caller may capture requestInterstitialAd while presentation is blocked, await product
  // cleanup, and invoke that older function after canPresent changes. Keep the latest committed
  // value in a ref so the captured function does not reject the request using a stale prop.
  const canPresentRef = useRef(canPresent)
  const isLoadedRef = useRef(false)
  const config = AppConfig.ads.interstitial
  const interstitialAdsEnabled = isInterstitialAdsEnabled()
  const isActive = canShowAds && interstitialAdsEnabled
  const autoPaywallIntervalMs = AppConfig.autoPaywall.intervalDays * 24 * 60 * 60 * 1_000

  useLayoutEffect(() => {
    canPresentRef.current = canPresent
  }, [canPresent])

  useEffect(() => {
    if (!isActive) {
      adRef.current = null
      isLoadedRef.current = false
      return
    }

    const ad = InterstitialAd.createForAdRequest(getAdUnitId('interstitial'))
    adRef.current = ad
    isLoadedRef.current = false

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      isLoadedRef.current = true
    })

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
      isLoadedRef.current = false
    })

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      isLoadedRef.current = false
      ad.load()
    })

    ad.load()

    return () => {
      unsubLoaded()
      unsubError()
      unsubClosed()
      if (adRef.current === ad) {
        adRef.current = null
        isLoadedRef.current = false
      }
    }
  }, [isActive])

  useEffect(() => {
    resetInterstitialForegroundCap()
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        resetInterstitialForegroundCap()
      }
      appStateRef.current = nextState
    })
    return () => subscription.remove()
  }, [resetInterstitialForegroundCap])

  const requestInterstitialAd: RequestInterstitialAd = async () => {
    if (!interstitialAdsEnabled || premiumState !== 'free') return

    recordInterstitialQualifyingCompletion()

    if (
      hasPaywallPrecedence(
        isPaywallShowing,
        autoPaywallEnabledAt,
        autoPaywallLastShownAt,
        autoPaywallIntervalMs
      )
    ) {
      return
    }

    const nextState = {
      qualifyingCompletionsSinceLastAd: interstitialQualifyingCompletionsSinceLastAd + 1,
      lastShownAt: interstitialLastShownAt,
      shownThisForeground: interstitialShownThisForeground,
    }
    if (!getInterstitialEligibility(nextState, config, Date.now())) return
    if (!canShowAds || !isLoadedRef.current) return
    if (interstitialAdPreventionSources.length > 0) return

    if (!canPresentRef.current) return

    const ad = adRef.current
    if (!ad) return

    try {
      await ad.show()
      recordInterstitialShown()
    } catch (error) {
      recordError(error, 'InterstitialAdProvider.show')
    }
  }

  return (
    <InterstitialAdContext.Provider value={requestInterstitialAd}>
      {children}
    </InterstitialAdContext.Provider>
  )
}

export const useRequestInterstitialAd = () => {
  const requestInterstitialAd = useContext(InterstitialAdContext)
  if (!requestInterstitialAd) {
    throw new Error('useRequestInterstitialAd must be used within InterstitialAdProvider')
  }
  return requestInterstitialAd
}
