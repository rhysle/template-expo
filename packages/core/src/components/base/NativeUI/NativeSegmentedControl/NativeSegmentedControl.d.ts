import type { JSX } from 'react'

export interface NativeSegmentedOption<T extends string> {
  label: string
  value: T
}

export interface NativeSegmentedControlProps<T extends string> {
  options: readonly NativeSegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  disabled?: boolean
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>
  testID?: string
}

export declare function NativeSegmentedControl<T extends string>(
  props: NativeSegmentedControlProps<T>
): JSX.Element
