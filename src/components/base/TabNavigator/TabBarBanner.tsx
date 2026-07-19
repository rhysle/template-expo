import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { BannerAd, type BannerAdDimensions, useCanShowAds } from '@/services/ads'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { useSetTabBarAccessoryHeight, useTabBarBaseHeight } from '../FloatingTabBar/tabBarHeight'

export const TabBarBanner = () => {
  const canShowAds = useCanShowAds()
  const tabBarHeight = useTabBarBaseHeight()
  const setAccessoryHeight = useSetTabBarAccessoryHeight()
  const [adHeight, setAdHeight] = useState(0)
  const { spacing } = useTheme()
  const styles = useThemedStyles(createStyles)

  const updateAdSize = ({ height }: BannerAdDimensions) => {
    setAdHeight(Math.ceil(height))
  }

  const accessoryHeight =
    canShowAds && adHeight > 0 ? adHeight + spacing.xs * 2 + StyleSheet.hairlineWidth * 2 : 0

  useEffect(() => {
    setAccessoryHeight(accessoryHeight)
    return () => setAccessoryHeight(0)
  }, [accessoryHeight, setAccessoryHeight])

  if (!canShowAds) return null

  return (
    <View
      style={[
        styles.container,
        { bottom: tabBarHeight },
        adHeight > 0 ? styles.loaded : undefined,
      ]}>
      <BannerAd onAdLoaded={updateAdSize} onSizeChange={updateAdSize} />
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    position: 'absolute',
    zIndex: 1,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loaded: {
    paddingVertical: t.spacing.xs,
    backgroundColor: t.colors.background.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border.subtle,
  },
}))
