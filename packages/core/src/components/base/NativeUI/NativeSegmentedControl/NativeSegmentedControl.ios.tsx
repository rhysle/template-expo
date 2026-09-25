import { Picker, Text } from '@expo/ui/swift-ui'
import { disabled, font, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers'
import { useTheme } from '@shared/core/theme'
import type { StyleProp, ViewStyle } from 'react-native'

import { resolveNativeFontFamily } from '../fontFamily'
import { NativeUIHost } from '../NativeUIHost'

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

export function NativeSegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  disabled: isDisabled = false,
  style,
  testID,
}: NativeSegmentedControlProps<T>) {
  const { typography } = useTheme()
  const selectedOption = options.find((option) => option.value === value)
  const fontFamily = resolveNativeFontFamily(typography.fontFamily.regular, 'regular')
  const fontModifier = fontFamily
    ? font({ family: fontFamily, textStyle: 'body', weight: 'regular' })
    : undefined

  return (
    <NativeUIHost matchContents={{ vertical: true }} style={style}>
      <Picker
        selection={selectedOption?.value}
        onSelectionChange={(selectedValue) => {
          const option = options.find((candidate) => candidate.value === selectedValue)
          if (option) onValueChange(option.value)
        }}
        modifiers={[
          pickerStyle('segmented'),
          ...(fontModifier ? [fontModifier] : []),
          ...(isDisabled ? [disabled(true)] : []),
        ]}
        testID={testID}>
        {options.map((option) => (
          <Text
            key={option.value}
            modifiers={[tag(option.value), ...(fontModifier ? [fontModifier] : [])]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </NativeUIHost>
  )
}
