import type { PropsWithChildren } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { View } from 'react-native'

import { createThemedStyles, useThemedStyles } from '@/theme'

import { useTabBarContentInset } from '../FloatingTabBar/tabBarHeight'

export interface TabScreenProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>
}

export const TabScreen = ({ children, style }: TabScreenProps) => {
  const bottomInset = useTabBarContentInset()
  const styles = useThemedStyles(createStyles)

  return (
    <View collapsable={false} style={[styles.container, { paddingBottom: bottomInset }, style]}>
      <View style={styles.content}>{children}</View>
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
