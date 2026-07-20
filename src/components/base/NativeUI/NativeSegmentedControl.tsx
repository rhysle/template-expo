import { SegmentedControl as ExpoSegmentedControl } from '@expo/ui/community/segmented-control'
import type { StyleProp, ViewStyle } from 'react-native'

import { useTheme } from '@/theme'

export interface NativeSegmentedOption<T extends string> {
  label: string
  value: T
}

export interface NativeSegmentedControlProps<T extends string> {
  options: readonly NativeSegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export const NativeSegmentedControl = <T extends string>({
  options,
  value,
  onValueChange,
  disabled = false,
  style,
  testID,
}: NativeSegmentedControlProps<T>) => {
  const { appearance, colors } = useTheme()
  const selectedIndex = options.findIndex((option) => option.value === value)

  return (
    <ExpoSegmentedControl
      values={options.map((option) => option.label)}
      selectedIndex={selectedIndex >= 0 ? selectedIndex : undefined}
      enabled={!disabled}
      tintColor={colors.primary.main}
      appearance={appearance}
      style={style}
      testID={testID}
      onChange={({ nativeEvent }) => {
        const option = options[nativeEvent.selectedSegmentIndex]
        if (option) onValueChange(option.value)
      }}
    />
  )
}
