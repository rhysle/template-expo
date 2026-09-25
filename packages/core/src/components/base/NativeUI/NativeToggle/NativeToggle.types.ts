import type { StyleProp, ViewStyle } from 'react-native'

export interface NativeToggleProps {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}
