import type { ReactNode } from 'react'
import { View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { Text } from '../Text'

const COMPACT_BAR_HEIGHT = 44
const DEFAULT_THRESHOLD = 60

export interface CollapsingHeaderProps {
  title: string
  scrollOffset: SharedValue<number>
  right?: ReactNode
  threshold?: number
}

export const CollapsingHeader = ({
  title,
  scrollOffset,
  right,
  threshold = DEFAULT_THRESHOLD,
}: CollapsingHeaderProps) => {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollOffset.value,
      [0, threshold],
      ['transparent', colors.background.base]
    ),
  }))

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollOffset.value, [0, threshold], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(scrollOffset.value, [0, threshold], [8, 0], Extrapolation.CLAMP),
      },
    ],
  }))

  return (
    <Animated.View
      style={[
        styles.container,
        { height: insets.top + COMPACT_BAR_HEIGHT },
        containerAnimatedStyle,
      ]}>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.content, contentAnimatedStyle]}>
          <Text
            variant="subtitle"
            weight="semibold"
            style={styles.title}
            numberOfLines={1}
            ellipsizeMode="tail">
            {title}
          </Text>
          {right ? <View style={styles.right}>{right}</View> : null}
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  bar: {
    flex: 1,
  },
  content: {
    height: COMPACT_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.spacing.lg,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  right: {
    position: 'absolute',
    right: t.spacing.md,
  },
}))
