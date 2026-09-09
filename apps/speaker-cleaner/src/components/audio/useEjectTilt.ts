import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'
import {
  SensorType,
  type SharedValue,
  useAnimatedSensor,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'

const FOCUSED_SENSOR_INTERVAL = 40
const BACKGROUND_SENSOR_INTERVAL = 1000
const STANDARD_GRAVITY = 9.81
const TILT_DEAD_ZONE = 0.04
const TILT_MAX_INPUT = 0.45
const MAX_TILT_DEGREES = 7.8
const SMOOTHING_TIME_CONSTANT = 180
const MAX_FRAME_DELTA = 64

export const useEjectTilt = (): SharedValue<number> => {
  const isFocused = useIsFocused()
  const reducedMotion = useReducedMotion()
  const tiltDegrees = useSharedValue(0)
  const gravity = useAnimatedSensor(SensorType.GRAVITY, {
    adjustToInterfaceOrientation: true,
    interval: isFocused && !reducedMotion ? FOCUSED_SENSOR_INTERVAL : BACKGROUND_SENSOR_INTERVAL,
  })

  const frameCallback = useFrameCallback(({ timeSincePreviousFrame }) => {
    'worklet'
    if (timeSincePreviousFrame === null) return

    const normalizedGravity = Math.min(
      Math.max(gravity.sensor.value.x / STANDARD_GRAVITY, -TILT_MAX_INPUT),
      TILT_MAX_INPUT
    )
    const magnitude = Math.abs(normalizedGravity)
    const inputProgress =
      magnitude <= TILT_DEAD_ZONE
        ? 0
        : (magnitude - TILT_DEAD_ZONE) / (TILT_MAX_INPUT - TILT_DEAD_ZONE)
    const direction = normalizedGravity < 0 ? -1 : 1
    const targetTilt = -direction * inputProgress * MAX_TILT_DEGREES
    const frameDelta = Math.min(timeSincePreviousFrame, MAX_FRAME_DELTA)
    const smoothing = 1 - Math.exp(-frameDelta / SMOOTHING_TIME_CONSTANT)

    tiltDegrees.value += (targetTilt - tiltDegrees.value) * smoothing
  }, isFocused && !reducedMotion)

  useEffect(() => {
    const shouldAnimate = isFocused && !reducedMotion
    frameCallback.setActive(shouldAnimate)
    if (!shouldAnimate) tiltDegrees.value = 0
  }, [frameCallback, isFocused, reducedMotion, tiltDegrees])

  return tiltDegrees
}
