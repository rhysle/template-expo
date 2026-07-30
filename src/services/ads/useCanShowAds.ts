import { AppConfig } from '@/configs'
import { useAdsState } from '@/stores/features/ads'
import { useSubscriptionState } from '@/stores/features/subscription'

/** True only when ads are enabled for a confirmed free user and the ads SDK is ready. */
export const useCanShowAds = () => {
  const { adsInitialized, canRequestAds } = useAdsState()
  const { premiumState } = useSubscriptionState()

  return AppConfig.ads.enabled && premiumState === 'free' && canRequestAds && adsInitialized
}
