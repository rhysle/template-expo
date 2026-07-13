import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { BannerAd as RNBannerAd } from 'react-native-google-mobile-ads'

import { AppConfig } from '@/configs'
import { useSubscriptionState } from '@/stores/features/subscription'

import { BannerAdSize, getAdUnitId } from './adsService'

export interface BannerAdProps {
  /** Override the ad unit ID. Defaults to AppConfig banner unit for current platform. */
  unitId?: string
  /** Ad size. Defaults to LARGE_ANCHORED_ADAPTIVE_BANNER. */
  size?: BannerAdSize
  /** Wrapper style - use to control margins and positioning around the ad. */
  style?: StyleProp<ViewStyle>
  onAdLoaded?: () => void
  onAdFailedToLoad?: (error: Error) => void
}

export const BannerAd = ({
  unitId,
  size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  style,
  onAdLoaded,
  onAdFailedToLoad,
}: BannerAdProps) => {
  const { isSubscribed } = useSubscriptionState()

  if (!AppConfig.ads.enabled || isSubscribed) {
    return null
  }

  return (
    <View style={[styles.container, style]}>
      <RNBannerAd
        unitId={unitId ?? getAdUnitId('banner')}
        size={size}
        onAdLoaded={onAdLoaded}
        onAdFailedToLoad={onAdFailedToLoad}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center' },
})
