import { useEffect } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import type { LoaderProps } from './types'

export const SpinArcLoader = ({ color, size = 20 }: LoaderProps) => {
  const rotation = useSharedValue(0)
  const thickness = Math.max(2, size * 0.125)

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 750, easing: Easing.linear }), -1)
    return () => cancelAnimation(rotation)
  }, [rotation])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderTopColor: color,
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
        },
        animatedStyle,
      ]}
    />
  )
}
