import {
  NativeSegmentedControl,
  NativeSlider,
  SegmentedControl,
  Slider,
} from '@shared/core/components/base'
import type { StyleProp, ViewStyle } from 'react-native'
import { Platform } from 'react-native'

interface CameraOptionSegmentedOption<T extends string> {
  value: T
  label: string
}

interface CameraOptionSegmentedControlProps<T extends string> {
  value: T
  options: readonly CameraOptionSegmentedOption<T>[]
  onValueChange: (value: T) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export const CameraOptionSegmentedControl = <T extends string>({
  value,
  options,
  onValueChange,
  disabled,
  style,
}: CameraOptionSegmentedControlProps<T>) =>
  Platform.OS === 'ios' ? (
    <NativeSegmentedControl
      value={value}
      options={options}
      onValueChange={onValueChange}
      disabled={disabled}
      style={style}
    />
  ) : (
    <SegmentedControl
      value={value}
      options={options}
      onValueChange={onValueChange}
      disabled={disabled}
      style={style}
    />
  )

interface CameraOptionSliderProps {
  value: number
  onValueChange: (value: number) => void
  onValueChangeFinished?: () => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  accessibilityLabel: string
  style?: StyleProp<ViewStyle>
}

export const CameraOptionSlider = ({
  value,
  onValueChange,
  onValueChangeFinished,
  min,
  max,
  step,
  disabled,
  accessibilityLabel,
  style,
}: CameraOptionSliderProps) =>
  Platform.OS === 'ios' ? (
    <NativeSlider
      value={value}
      onValueChange={onValueChange}
      onValueChangeFinished={onValueChangeFinished}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      style={style}
    />
  ) : (
    <Slider
      value={value}
      onValueChange={onValueChange}
      onValueChangeFinished={onValueChangeFinished}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={style}
    />
  )
