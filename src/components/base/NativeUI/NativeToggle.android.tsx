import { Row, Switch, Text } from '@expo/ui/jetpack-compose'
import { testID as testIDModifier, weight } from '@expo/ui/jetpack-compose/modifiers'
import type { StyleProp, ViewStyle } from 'react-native'

import { useTheme } from '@/theme'

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
}: NativeToggleProps) => {
  const { colors } = useTheme()
  const toggle = (
    <Switch
      value={value}
      onCheckedChange={disabled ? undefined : onValueChange}
      enabled={!disabled}
      colors={{
        checkedThumbColor: colors.background.surface,
        checkedTrackColor: colors.primary.main,
        checkedBorderColor: colors.primary.main,
        uncheckedThumbColor: colors.background.subtle,
        uncheckedTrackColor: colors.background.surface,
        uncheckedBorderColor: colors.border.subtle,
      }}
      modifiers={testID ? [testIDModifier(testID)] : undefined}
    />
  )

  return (
    <NativeUIHost style={style}>
      {label ? (
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <Text modifiers={[weight(1)]}>{label}</Text>
          {toggle}
        </Row>
      ) : (
        toggle
      )}
    </NativeUIHost>
  )
}
