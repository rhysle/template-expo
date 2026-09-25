import { Switch } from '@expo/ui'
import { font } from '@expo/ui/swift-ui/modifiers'
import { useTheme } from '@shared/core/theme'

import { resolveNativeFontFamily } from '../fontFamily'
import { NativeUIHost } from '../NativeUIHost'
import type { NativeToggleProps } from './NativeToggle.types'

export const NativeToggle = ({
  value,
  onValueChange,
  label,
  disabled,
  style,
  testID,
}: NativeToggleProps) => {
  const { typography } = useTheme()
  const fontFamily = resolveNativeFontFamily(typography.fontFamily.regular, 'regular')

  return (
    <NativeUIHost style={style}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        label={label}
        disabled={disabled}
        testID={testID}
        modifiers={fontFamily ? [font({ family: fontFamily, textStyle: 'body' })] : undefined}
      />
    </NativeUIHost>
  )
}
