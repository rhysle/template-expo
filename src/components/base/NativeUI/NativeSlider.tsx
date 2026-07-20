import { Slider } from '@expo/ui'
import type { StyleProp, ViewStyle } from 'react-native'

import { NativeUIHost } from './NativeUIHost'

export interface NativeSliderProps {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export const NativeSlider = ({
  value,
  onValueChange,
  min,
  max,
  step,
  disabled,
  style,
  testID,
}: NativeSliderProps) => (
  <NativeUIHost matchContents={{ vertical: true }} style={[{ width: '100%' }, style]}>
    <Slider
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      testID={testID}
    />
  </NativeUIHost>
)
