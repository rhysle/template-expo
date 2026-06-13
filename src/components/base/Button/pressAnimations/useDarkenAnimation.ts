import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { ButtonAnimationResult } from '../types'

export const useDarkenAnimation = (): ButtonAnimationResult => {
  const progress = useSharedValue(0)

  const overlayStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)']),
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
    disableOpacity: true,
  }
}
