import { Slider } from '@expo/ui/jetpack-compose'
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers'

import { NativeUIHost } from '../NativeUIHost'
import type { NativeSliderProps } from './NativeSlider.types'

export const NativeSlider = ({
  value,
  onValueChange,
  onValueChangeFinished,
  min = 0,
  max = 1,
  step,
  disabled,
  style,
  testID,
}: NativeSliderProps) => {
  const steps = step != null && step > 0 ? Math.max(Math.round((max - min) / step) - 1, 0) : 0
  const handleValueChange =
    step != null && step > 0
      ? (nextValue: number) => onValueChange(Math.round((nextValue - min) / step) * step + min)
      : onValueChange

  return (
    <NativeUIHost matchContents={{ vertical: true }} style={[{ width: '100%' }, style]}>
      <Slider
        value={value}
        onValueChange={disabled ? undefined : handleValueChange}
        onValueChangeFinished={onValueChangeFinished}
        min={min}
        max={max}
        steps={steps}
        enabled={!disabled}
        modifiers={testID ? [testIDModifier(testID)] : undefined}
      />
    </NativeUIHost>
  )
}
