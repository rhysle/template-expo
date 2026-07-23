import { useEffect } from 'react'
import { Pressable, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { useIsRTL } from '@/services/rtl'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'
import { haptics } from '@/utils/haptics'

const TOGGLE_WIDTH = 44
const TOGGLE_HEIGHT = 24
const THUMB_SIZE = 20
const THUMB_OFFSET = 2
const THUMB_TRAVEL = TOGGLE_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2

export interface ToggleProps {
  value: boolean
  onValueChange?: (value: boolean) => void
  disabled?: boolean
  haptic?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export const Toggle = ({
  value,
  onValueChange,
  disabled = false,
  haptic = true,
  style,
  testID,
}: ToggleProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const isRTL = useIsRTL()
  const progress = useSharedValue(value ? 1 : 0)

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      damping: 16,
      stiffness: 180,
      mass: 0.7,
    })
  }, [progress, value])

  const trackAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.background.subtle, colors.primary.main]
    ),
  }))

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [0, isRTL ? -THUMB_TRAVEL : THUMB_TRAVEL]),
      },
    ],
  }))

  return (
    <Pressable
      onPress={() => {
        if (!disabled) {
          if (haptic) void haptics.medium()
          onValueChange?.(!value)
        }
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
      style={[disabled && styles.disabled, style]}>
      <Animated.View style={[styles.track, trackAnimatedStyle]}>
        <Animated.View style={[styles.thumb, thumbAnimatedStyle]} />
      </Animated.View>
    </Pressable>
  )
}

const createStyles = createThemedStyles((t) => ({
  track: {
    width: TOGGLE_WIDTH,
    height: TOGGLE_HEIGHT,
    borderRadius: TOGGLE_HEIGHT / 2,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: t.colors.background.surface,
    marginStart: THUMB_OFFSET,
  },
  disabled: {
    opacity: 0.5,
  },
}))
