import { SegmentedButton, SingleChoiceSegmentedButtonRow } from '@expo/ui/jetpack-compose'
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers'
import { useTheme } from '@shared/core/theme'
import type { StyleProp, ViewStyle } from 'react-native'

import { NativeText } from '../NativeText'
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
  disabled = false,
  style,
  testID,
}: NativeSegmentedControlProps<T>) {
  const { colors, typography } = useTheme()
  const textColor = disabled ? colors.text.muted : colors.text.primary
  const inactiveTextColor = disabled ? colors.text.muted : colors.text.secondary
  const buttonColors = {
    activeBorderColor: colors.primary.main,
    activeContentColor: textColor,
    activeContainerColor: colors.primary.soft,
    inactiveBorderColor: colors.border.default,
    inactiveContentColor: inactiveTextColor,
    inactiveContainerColor: colors.background.surface,
    disabledActiveBorderColor: colors.border.subtle,
    disabledActiveContentColor: colors.text.muted,
    disabledActiveContainerColor: colors.background.subtle,
    disabledInactiveBorderColor: colors.border.subtle,
    disabledInactiveContentColor: colors.text.muted,
    disabledInactiveContainerColor: colors.background.surface,
  }

  return (
    <NativeUIHost matchContents={{ vertical: true }} style={style}>
      <SingleChoiceSegmentedButtonRow modifiers={testID ? [testIDModifier(testID)] : undefined}>
        {options.map((option) => (
          <SegmentedButton
            key={option.value}
            selected={option.value === value}
            enabled={!disabled}
            colors={buttonColors}
            onClick={() => onValueChange(option.value)}>
            <SegmentedButton.Label>
              <NativeText textStyle={{ fontSize: typography.sizes.base }} weight="medium">
                {option.label}
              </NativeText>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </NativeUIHost>
  )
}
