import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useEffectEvent, useRef } from 'react'
import type { AppStateStatus } from 'react-native'
import { AppState } from 'react-native'

import { AppConfig } from '@/configs'
import { AnalyticsEvents, trackEvent } from '@/services/firebase/analytics'
import { usePaywallState } from '@/stores/features/paywall'
import { useSubscriptionState } from '@/stores/features/subscription'

const INTERVAL_MS = AppConfig.autoPaywall.intervalDays * 24 * 60 * 60 * 1000

export const useAutoPaywall = () => {
  const router = useRouter()
  const { isSubscribed, revenueCatReady } = useSubscriptionState()
  const {
    autoPaywallEnabledAt,
    autoPaywallLastShownAt,
    initAutoPaywallEnabled,
    recordAutoPaywallShown,
    setAutoPaywallShowing,
  } = usePaywallState()
  const isShowingRef = useRef(false)

  const maybeShowPaywall = useEffectEvent(() => {
    if (isShowingRef.current) return
    if (!revenueCatReady) return
    if (isSubscribed) return

    if (autoPaywallEnabledAt === null) {
      initAutoPaywallEnabled()
      return
    }

    const baseline = autoPaywallLastShownAt ?? autoPaywallEnabledAt
    if (Date.now() - baseline >= INTERVAL_MS) {
      isShowingRef.current = true
      setAutoPaywallShowing(true)
      trackEvent(AnalyticsEvents.AUTO_PAYWALL_TRIGGERED)
      recordAutoPaywallShown()
      router.push('/paywall')
    }
  })

  // Run on mount (cold launch) and when RevenueCat finishes its first status check.
  // The mount effect fires before RC is ready; the revenueCatReady effect catches
  // the transition so cold-launch triggering still works when RC is slow to init.
  useEffect(() => {
    maybeShowPaywall()
  }, [])

  useEffect(() => {
    if (revenueCatReady) {
      maybeShowPaywall()
    }
  }, [revenueCatReady])

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
      setAutoPaywallShowing(false)
    }, [setAutoPaywallShowing])
  )
}
