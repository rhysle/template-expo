import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'

import { AppConfig } from '@/configs'
import { BannerAd, useCanShowAds } from '@/services/ads'
import { createThemedStyles, useThemedStyles } from '@/theme'

import { useSetTabBarAccessoryHeight, useTabBarBaseHeight } from '../FloatingTabBar/tabBarHeight'

const ADS_BANNER_HEIGHT = 50

export const TabBarBanner = () => {
  const canShowAds = useCanShowAds()
  const tabBarHeight = useTabBarBaseHeight()
  const setAccessoryHeight = useSetTabBarAccessoryHeight()
  const styles = useThemedStyles(createStyles)

  const isEligible = canShowAds && AppConfig.ads.banner.enabled

  const accessoryHeight = isEligible ? ADS_BANNER_HEIGHT + StyleSheet.hairlineWidth * 2 : 0

  useEffect(() => {
    setAccessoryHeight(accessoryHeight)
    return () => setAccessoryHeight(0)
  }, [accessoryHeight, setAccessoryHeight])

  if (!isEligible) return null

  return (
    <View style={[styles.container, { bottom: tabBarHeight }, { height: accessoryHeight }]}>
      <BannerAd />
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
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
}))
