import type { StyleProp, ViewStyle } from 'react-native'

export interface NativeSliderProps {
  value: number
  onValueChange: (value: number) => void
  onValueChangeFinished?: () => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}
