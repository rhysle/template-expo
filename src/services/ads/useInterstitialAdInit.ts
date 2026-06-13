import { useEffect } from 'react'
import { AppState } from 'react-native'

import { useAdsState } from '@/stores/features/ads'

import { useInterstitialAd } from './useInterstitialAd'

/**
 * Lifecycle hook for interstitial ads. Call once in TabLayout.
 * - Counts cold start and each foreground resume as a session (grace period tracking)
 * - Attempts to show an interstitial on every foreground resume
 */
export const useInterstitialAdInit = () => {
  const { show } = useInterstitialAd()
  const { incrementInterstitialSessionCount } = useAdsState()

  useEffect(() => {
    incrementInterstitialSessionCount()
  }, [incrementInterstitialSessionCount])

  useEffect(() => {
    let previousState = AppState.currentState
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousState === 'background' && nextState === 'active') {
        incrementInterstitialSessionCount()
        void show()
      }
      previousState = nextState
    })
    return () => subscription.remove()
  }, [show, incrementInterstitialSessionCount])
}
