import { useRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Platform, StyleSheet, View } from 'react-native'
import { BannerAd as RNBannerAd, useForeground } from 'react-native-google-mobile-ads'

import { BannerAdSize, getAdUnitId } from './adsService'
import { useCanShowAds } from './useCanShowAds'

export interface BannerAdDimensions {
  height: number
  width: number
}

export interface BannerAdProps {
  /** Override the ad unit ID. Defaults to AppConfig banner unit for current platform. */
  unitId?: string
  /** Ad size. Defaults to the compact anchored adaptive format. */
  size?: BannerAdSize
  /** Wrapper style - use to control margins and positioning around the ad. */
  style?: StyleProp<ViewStyle>
  onAdLoaded?: (dimensions: BannerAdDimensions) => void
  onAdFailedToLoad?: (error: Error) => void
  onSizeChange?: (dimensions: BannerAdDimensions) => void
}

export const BannerAd = ({
  unitId,
  size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  style,
  onAdLoaded,
  onAdFailedToLoad,
  onSizeChange,
}: BannerAdProps) => {
  const bannerRef = useRef<RNBannerAd>(null)
  const canShowAds = useCanShowAds()

  useForeground(() => {
    if (Platform.OS === 'ios' && canShowAds) {
      bannerRef.current?.load()
    }
  })

  if (!canShowAds) {
    return null
  }

  return (
    <View style={[styles.container, style]}>
      <RNBannerAd
        ref={bannerRef}
        unitId={unitId ?? getAdUnitId('banner')}
        size={size}
        onAdLoaded={onAdLoaded}
        onAdFailedToLoad={onAdFailedToLoad}
        onSizeChange={onSizeChange}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center' },
})
