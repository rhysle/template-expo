import { Platform } from 'react-native'

export type NativeFontWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold'

const POST_SCRIPT_SUFFIX: Record<NativeFontWeight, string> = {
  light: 'Light',
  regular: 'Regular',
  medium: 'Medium',
  semibold: 'SemiBold',
  bold: 'Bold',
}

const GOOGLE_FONT_RUNTIME_ALIAS =
  /_(?:100Thin|200ExtraLight|300Light|400Regular|500Medium|600SemiBold|700Bold|800ExtraBold|900Black)$/

/** Resolves the registered face name expected by Expo UI's SwiftUI Font.custom. */
export function resolveNativeFontFamily(
  family: string | undefined,
  weight: NativeFontWeight
): string | undefined {
  if (!family || Platform.OS !== 'ios') return family

  const baseFamily = family.replace(GOOGLE_FONT_RUNTIME_ALIAS, '')
  const postScriptName = `${baseFamily}-${POST_SCRIPT_SUFFIX[weight]}`

  return baseFamily.endsWith(`-${POST_SCRIPT_SUFFIX[weight]}`) ? baseFamily : postScriptName
}
