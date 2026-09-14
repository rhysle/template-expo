import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import type { LoaderProps } from './types'

const DOT_SIZE = 7
const BOUNCE_HEIGHT = 7
const DURATION = 300
const STAGGER = 150

const Dot = ({ color, delay }: { color: string; delay: number }) => {
  const translateY = useSharedValue(0)

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-BOUNCE_HEIGHT, { duration: DURATION }),
          withTiming(0, { duration: DURATION })
        ),
        -1
      )
    )
    return () => cancelAnimation(translateY)
  }, [delay, translateY])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View
      style={[
        {
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  )
}

export const BouncingDotsLoader = ({ color }: LoaderProps) => {
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', height: 20 }}>
      <Dot color={color} delay={0} />
      <Dot color={color} delay={STAGGER} />
      <Dot color={color} delay={STAGGER * 2} />
    </View>
  )
}
