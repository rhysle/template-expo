import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useEffectEvent, useRef } from 'react'
import type { AppStateStatus } from 'react-native'
import { AppState } from 'react-native'

import { AppConfig } from '@/configs'
import { AnalyticsGeneralEvents, trackEvent } from '@/services/firebase/analytics'
import { useAdsState } from '@/stores/features/ads'
import { usePaywallState } from '@/stores/features/paywall'
import { useSubscriptionState } from '@/stores/features/subscription'

import { buildPaywallPath, type PaywallSource, shouldTriggerAutoPaywall } from './premiumAccess'

const INTERVAL_MS = AppConfig.autoPaywall.intervalDays * 24 * 60 * 60 * 1000
const AUTO_PAYWALL_SOURCE = 'automatic' satisfies PaywallSource

export const useAutoPaywall = (shouldPreventPaywall = false) => {
  const router = useRouter()
  const { premiumState } = useSubscriptionState()
  const { interstitialAdPreventionSources, interstitialShownThisForeground } = useAdsState()
  const {
    autoPaywallEnabledAt,
    autoPaywallLastShownAt,
    isPaywallShowing,
    initAutoPaywallEnabled,
    recordAutoPaywallShown,
    setPaywallShowing,
  } = usePaywallState()
  const isShowingRef = useRef(false)

  const maybeShowPaywall = useEffectEvent(() => {
    if (isShowingRef.current) return
    if (premiumState !== 'free') return
    if (isPaywallShowing || interstitialAdPreventionSources.length > 0) return
    if (interstitialShownThisForeground) return
    if (shouldPreventPaywall) return

    if (autoPaywallEnabledAt === null) {
      initAutoPaywallEnabled()
      return
    }

    if (shouldTriggerAutoPaywall(autoPaywallEnabledAt, autoPaywallLastShownAt, INTERVAL_MS)) {
      isShowingRef.current = true
      setPaywallShowing(true)
      trackEvent(AnalyticsGeneralEvents.AUTO_PAYWALL_TRIGGERED)
      recordAutoPaywallShown()
      router.push(buildPaywallPath(AUTO_PAYWALL_SOURCE))
    }
  })

  // Run when access resolves or a blocking state becomes idle.
  useEffect(() => {
    maybeShowPaywall()
  }, [
    premiumState,
    shouldPreventPaywall,
    isPaywallShowing,
    interstitialShownThisForeground,
    interstitialAdPreventionSources.length,
  ])

  // Run on foreground resume
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        maybeShowPaywall()
      }
    })
    return () => subscription.remove()
  }, [])

  // Reset isShowingRef when tabs regain focus (modal was dismissed)
  useFocusEffect(
    useCallback(() => {
      isShowingRef.current = false
      setPaywallShowing(false)
    }, [setPaywallShowing])
  )
}
