import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import type { ButtonAnimationResult } from '../types'

export const useScaleAnimation = (): ButtonAnimationResult => {
  const scale = useSharedValue(1)

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return {
    outerStyle,
    overlayStyle: {},
    onPressIn: () => {
      scale.value = withTiming(0.96, { duration: 60, easing: Easing.out(Easing.quad) })
    },
    onPressOut: () => {
      scale.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) })
    },
    disableOpacity: true,
  }
}
