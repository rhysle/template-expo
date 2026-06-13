import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { View } from 'react-native'

import { BannerAd } from '@/services/ads'

import { TabBar } from '../TabBar'
import { useSetTabBarHeight } from './tabBarHeight'

export const FloatingTabBar = (props: BottomTabBarProps) => {
  const setHeight = useSetTabBarHeight()
  return (
    <View
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <BannerAd />
      <TabBar {...props} blur />
    </View>
  )
}
