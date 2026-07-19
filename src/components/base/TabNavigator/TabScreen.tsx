import { useIsFocused } from 'expo-router'
import { type PropsWithChildren, useEffect } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { View } from 'react-native'

import { BannerAd } from '@/services/ads'
import { createThemedStyles, useThemedStyles } from '@/theme'

import { useSetTabBarAccessoryHeight, useTabBarContentInset } from '../FloatingTabBar/tabBarHeight'

export interface TabScreenProps extends PropsWithChildren {
  showBanner?: boolean
  style?: StyleProp<ViewStyle>
}

const FocusedBannerAd = () => {
  const setAccessoryHeight = useSetTabBarAccessoryHeight()

  useEffect(() => () => setAccessoryHeight(0), [setAccessoryHeight])

  return (
    <View onLayout={(event) => setAccessoryHeight(event.nativeEvent.layout.height)}>
      <BannerAd />
    </View>
  )
}

export const TabScreen = ({ children, showBanner = true, style }: TabScreenProps) => {
  const isFocused = useIsFocused()
  const bottomInset = useTabBarContentInset()
  const styles = useThemedStyles(createStyles)

  return (
    <View collapsable={false} style={[styles.container, { paddingBottom: bottomInset }, style]}>
      <View style={styles.content}>{children}</View>
      {showBanner && isFocused ? <FocusedBannerAd /> : null}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.background.base,
  },
  content: {
    flex: 1,
  },
}))
