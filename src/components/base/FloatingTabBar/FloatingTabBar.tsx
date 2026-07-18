import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { View } from 'react-native'

import { BannerAd } from '@/services/ads'

import { TabBar, type TabBarProps } from '../TabBar'
import { useSetTabBarHeight } from './tabBarHeight'

export interface FloatingTabBarProps extends BottomTabBarProps {
  showLabel?: TabBarProps['showLabel']
}

export const FloatingTabBar = ({ showLabel, ...props }: FloatingTabBarProps) => {
  const setHeight = useSetTabBarHeight()
  return (
    <View
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <BannerAd />
      <TabBar {...props} blur showLabel={showLabel} />
    </View>
  )
}
