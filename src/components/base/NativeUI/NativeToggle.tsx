import { Switch } from '@expo/ui'
import type { StyleProp, ViewStyle } from 'react-native'

import { NativeUIHost } from './NativeUIHost'

export interface NativeToggleProps {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export const NativeToggle = ({
  value,
  onValueChange,
  label,
  disabled,
  style,
  testID,
}: NativeToggleProps) => (
  <NativeUIHost style={style}>
    <Switch
      value={value}
      onValueChange={onValueChange}
      label={label}
      disabled={disabled}
      testID={testID}
    />
  </NativeUIHost>
)
