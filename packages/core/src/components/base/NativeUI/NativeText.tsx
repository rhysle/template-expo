import { Text as ExpoText, type TextProps as ExpoTextProps } from '@expo/ui'
import { useTheme } from '@shared/core/theme'

import { type NativeFontWeight, resolveNativeFontFamily } from './fontFamily'

export type NativeTextWeight = NativeFontWeight

export interface NativeTextProps extends Omit<ExpoTextProps, 'textStyle'> {
  textStyle?: ExpoTextProps['textStyle']
  weight?: NativeTextWeight
}

/** Expo UI text that resolves the app's active font and language fallback. */
export function NativeText({ weight = 'regular', textStyle, ...props }: NativeTextProps) {
  const { typography } = useTheme()
  const fontFamily = resolveNativeFontFamily(typography.fontFamily[weight], weight)

  return (
    <ExpoText
      {...props}
      textStyle={{
        ...textStyle,
        fontWeight: textStyle?.fontWeight ?? typography.weights[weight],
        ...(fontFamily ? { fontFamily } : {}),
      }}
    />
  )
}
