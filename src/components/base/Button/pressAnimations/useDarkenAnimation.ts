import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { withAlpha } from '@/utils/color'

import type { ButtonAnimationResult } from '../types'

export const useDarkenAnimation = (
  overlayColor: string,
  overlayOpacity: number
): ButtonAnimationResult => {
  const progress = useSharedValue(0)
  const transparentOverlayColor = withAlpha(overlayColor, 0)
  const pressedOverlayColor = withAlpha(overlayColor, overlayOpacity)

  const overlayStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [transparentOverlayColor, pressedOverlayColor]
    ),
  }))

  return {
    outerStyle: {},
    overlayStyle,
    onPressIn: () => {
      progress.value = withTiming(1, { duration: 80 })
    },
    onPressOut: () => {
      progress.value = withTiming(0, { duration: 200 })
    },
  }
}
