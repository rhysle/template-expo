import { useEffect } from 'react'

import { useAdsState } from '@/stores/features/ads'

/**
 * Prevents interstitial presentation while `shouldPrevent` is true.
 *
 * Use a stable, unique `source` for each prevention reason. Multiple sources can overlap safely,
 * and this hook automatically clears its source when the component unmounts or either argument
 * changes.
 */
export const usePreventInterstitialAd = (source: string, shouldPrevent: boolean) => {
  const { setInterstitialAdPrevented } = useAdsState()

  useEffect(() => {
    setInterstitialAdPrevented(source, shouldPrevent)
    return () => setInterstitialAdPrevented(source, false)
  }, [setInterstitialAdPrevented, shouldPrevent, source])
}
