import { View } from 'react-native'
import Animated, {
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

interface PaginationDotsProps {
  count: number
  currentIndex: SharedValue<number>
}

interface DotProps {
  index: number
  currentIndex: SharedValue<number>
  activeColor: string
  inactiveColor: string
}

const DOT_SIZE = 8
const ACTIVE_DOT_WIDTH = 24

const Dot = ({ index, currentIndex, activeColor, inactiveColor }: DotProps) => {
  const styles = useThemedStyles(createStyles)

  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(
      currentIndex.value,
      [index - 1, index, index + 1],
      [DOT_SIZE, ACTIVE_DOT_WIDTH, DOT_SIZE],
      'clamp'
    ),
    backgroundColor: interpolateColor(
      currentIndex.value,
      [index - 1, index, index + 1],
      [inactiveColor, activeColor, inactiveColor]
    ),
  }))

  return <Animated.View style={[styles.dot, animatedStyle]} />
}

export const PaginationDots = ({ count, currentIndex }: PaginationDotsProps) => {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      {Array.from({ length: count }, (_, i) => (
        <Dot
          key={i}
          index={i}
          currentIndex={currentIndex}
          activeColor={colors.primary.main}
          inactiveColor={colors.text.muted}
        />
      ))}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
}))
