import type { ComponentType } from 'react'

import { useFoundationRuntime } from '../../runtime'
import type { FoundationConfig } from '../../runtime/config'
import { useAdsState } from '../../stores/features/ads'
import { useSubscriptionState } from '../../stores/features/subscription'
import type { BannerAdProps } from './disabled'
export interface FoundationAds {
  BannerAd: ComponentType<Omit<BannerAdProps, 'size'>>
  isBannerAdsEnabled: (config: FoundationConfig) => boolean
}
export const BannerAd = (props: Omit<BannerAdProps, 'size'>) => {
  const { ads } = useFoundationRuntime()
  const Component = ads.BannerAd
  return <Component {...props} />
}
export const useBannerAdsEnabled = (): boolean => {
  const runtime = useFoundationRuntime()
  return runtime.ads.isBannerAdsEnabled(runtime.config)
}
export const useCanShowAds = (): boolean => {
  const { config } = useFoundationRuntime()
  const { adsInitialized, canRequestAds } = useAdsState()
  const { premiumState } = useSubscriptionState()
  return config.ads.enabled && premiumState === 'free' && canRequestAds && adsInitialized
}
