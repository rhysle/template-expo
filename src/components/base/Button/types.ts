import type { ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

export type AnimationType = 'scale' | 'darken' | 'none'

export type LoadingAnimationType = 'spin-arc' | 'bouncing-dots' | 'pulsing-ring'

export interface ButtonAnimationResult {
  outerStyle: AnimatedStyle<ViewStyle>
  overlayStyle: AnimatedStyle<ViewStyle>
  onPressIn: () => void
  onPressOut: () => void
  disableOpacity: boolean
}
