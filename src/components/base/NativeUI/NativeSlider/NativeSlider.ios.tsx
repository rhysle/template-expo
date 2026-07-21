import { Slider } from '@expo/ui/swift-ui'
import { disabled as disabledModifier } from '@expo/ui/swift-ui/modifiers'

import { NativeUIHost } from '../NativeUIHost'
import type { NativeSliderProps } from './NativeSlider.types'

export const NativeSlider = ({
  value,
  onValueChange,
  onValueChangeFinished,
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
      onEditingChanged={(isEditing) => {
        if (!isEditing) onValueChangeFinished?.()
      }}
      min={min}
      max={max}
      step={step}
      modifiers={disabled ? [disabledModifier(true)] : undefined}
      testID={testID}
    />
  </NativeUIHost>
)
