import { useEffect } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import type { LoaderProps } from './types'

const ROTATION_DURATION = 750
const ARC_DEGREES = 280
const SEGMENT_COUNT = 32
const SEGMENT_OVERLAP_DEGREES = 1
const MINIMUM_TAIL_OPACITY = 0.03
const OPACITY_CURVE = 1.7

const GRADIENT_SEGMENTS = Array.from({ length: SEGMENT_COUNT }, (_, index) => {
  const progress = (index + 1) / SEGMENT_COUNT

  return {
    opacity: MINIMUM_TAIL_OPACITY + (1 - MINIMUM_TAIL_OPACITY) * Math.pow(progress, OPACITY_CURVE),
    rotation: index * (ARC_DEGREES / SEGMENT_COUNT),
  }
})

export const SpinArcLoader = ({ color, size = 20 }: LoaderProps) => {
  const rotation = useSharedValue(0)
  const thickness = Math.max(2, size * 0.125)
  const center = size / 2
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const segmentLength =
    circumference * ((ARC_DEGREES / SEGMENT_COUNT + SEGMENT_OVERLAP_DEGREES) / 360)

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: ROTATION_DURATION, easing: Easing.linear }),
      -1
    )
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
        },
        animatedStyle,
      ]}>
      <Svg
        accessible={false}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        pointerEvents="none">
        {GRADIENT_SEGMENTS.map((segment, index) => (
          <Circle
            key={index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeDasharray={[segmentLength, circumference]}
            strokeLinecap={index === SEGMENT_COUNT - 1 ? 'round' : 'butt'}
            strokeOpacity={segment.opacity}
            strokeWidth={thickness}
            transform={`rotate(${segment.rotation} ${center} ${center})`}
          />
        ))}
      </Svg>
    </Animated.View>
  )
}
