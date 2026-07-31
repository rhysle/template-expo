import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import type { ButtonAnimationResult } from '../types'

export const useOpacityAnimation = (): ButtonAnimationResult => {
  const opacity = useSharedValue(1)

  const outerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return {
    outerStyle,
    overlayStyle: {},
    onPressIn: () => {
      opacity.value = withTiming(0.72, { duration: 80, easing: Easing.out(Easing.quad) })
    },
    onPressOut: () => {
      opacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) })
    },
  }
}
