import { Easing, LinearTransition, ReduceMotion } from 'react-native-reanimated'

export const CAMERA_LAYOUT_TIMING = {
  duration: 420,
  easing: Easing.inOut(Easing.cubic),
  reduceMotion: ReduceMotion.System,
}

export const CAMERA_CONTAINER_TRANSITION = LinearTransition.duration(CAMERA_LAYOUT_TIMING.duration)
  .easing(CAMERA_LAYOUT_TIMING.easing)
  .reduceMotion(CAMERA_LAYOUT_TIMING.reduceMotion)
