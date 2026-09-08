import type { ComponentType } from 'react'

import { useCoreRuntime } from '../../runtime'
import type { CoreConfig } from '../../runtime/config'
import { useAdsState } from '../../stores/features/ads'
import { useSubscriptionState } from '../../stores/features/subscription'
import type { BannerAdProps } from './disabled'
export interface CoreAds {
  BannerAd: ComponentType<Omit<BannerAdProps, 'size'>>
  isBannerAdsEnabled: (config: CoreConfig) => boolean
}
export const BannerAd = (props: Omit<BannerAdProps, 'size'>) => {
  const { ads } = useCoreRuntime()
  const Component = ads.BannerAd
  return <Component {...props} />
}
export const useBannerAdsEnabled = (): boolean => {
  const runtime = useCoreRuntime()
  return runtime.ads.isBannerAdsEnabled(runtime.config)
}
export const useCanShowAds = (): boolean => {
  const { config } = useCoreRuntime()
  const { adsInitialized, canRequestAds } = useAdsState()
  const { premiumState } = useSubscriptionState()
  return config.ads.enabled && premiumState === 'free' && canRequestAds && adsInitialized
}
