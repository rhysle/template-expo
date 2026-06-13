import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import type { LoaderProps } from './types'

const SIZE = 20
const DURATION = 1400
const RING_DELAY = 700
const MIN_SCALE = 0.6
const MAX_SCALE = 1.6

const Ring = ({ color, delay }: { color: string; delay: number }) => {
  const scale = useSharedValue(MIN_SCALE)

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(withTiming(MAX_SCALE, { duration: DURATION }), -1))
    return () => cancelAnimation(scale)
  }, [delay, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [MIN_SCALE, MAX_SCALE], [1, 0]),
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          borderWidth: 2,
          borderColor: color,
        },
        animatedStyle,
      ]}
    />
  )
}

export const PulsingRingLoader = ({ color }: LoaderProps) => {
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Ring color={color} delay={0} />
      <Ring color={color} delay={RING_DELAY} />
    </View>
  )
}
