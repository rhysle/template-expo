import { AppConfig } from '@/configs'
import { useAdsState } from '@/stores/features/ads'
import { useSubscriptionState } from '@/stores/features/subscription'

/** True only after privacy eligibility and Mobile Ads initialization have completed. */
export const useCanShowAds = () => {
  const { adsInitialized, canRequestAds } = useAdsState()
  const { isSubscribed } = useSubscriptionState()

  return AppConfig.ads.enabled && !isSubscribed && canRequestAds && adsInitialized
}
