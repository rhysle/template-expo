// Font configuration - single source of truth for the app's font family.
// Dev: @expo-google-fonts/dev loads weight-specific aliases over the network (no rebuild).
// Prod: one weighted family is embedded via the expo-font config plugin (requires prebuild).
//
// To change font: npx tsx scripts/setup-font.ts "Font Name"
//
// To check if a font is available in @expo-google-fonts/dev, search the package's source:
// import { BodoniModaSC_400Regular, OpenSans_300Light } from '@expo-google-fonts/dev'

export const FONT_NAME = 'Inter'

export const runtimeFontFamilyMap = {
  light: `${FONT_NAME}_300Light`,
  regular: `${FONT_NAME}_400Regular`,
  medium: `${FONT_NAME}_500Medium`,
  semibold: `${FONT_NAME}_600SemiBold`,
  bold: `${FONT_NAME}_700Bold`,
} as const

export type FontWeight = keyof typeof runtimeFontFamilyMap
export type FontFamilyMap = Record<FontWeight, string>

// Android registers these files as one XML family and iOS reads the same family
// from the font metadata. Numeric fontWeight selects the embedded face.
export const fontFamilyMap = {
  light: FONT_NAME,
  regular: FONT_NAME,
  medium: FONT_NAME,
  semibold: FONT_NAME,
  bold: FONT_NAME,
} as const satisfies FontFamilyMap

// Widened type for the active font map: Latin scripts use named font strings,
// non-Latin scripts use undefined to trigger the OS system font fallback.
export type ResolvedFontFamilyMap = FontFamilyMap | Record<FontWeight, undefined>

// All-undefined map - React Native treats undefined fontFamily as "use system font"
const systemFontFamilyMap: Record<FontWeight, undefined> = {
  light: undefined,
  regular: undefined,
  medium: undefined,
  semibold: undefined,
  bold: undefined,
}

// Explicit allowlist of Latin-script language codes.
// Anything not listed falls back to the OS system font automatically.
const LATIN_LANGUAGES = new Set([
  'en',
  'vi',
  'ca',
  'fr',
  'de',
  'es',
  'pt',
  'it',
  'nl',
  'pl',
  'tr',
  'id',
  'ms',
  'ro',
  'cs',
  'sk',
  'hr',
  'sl',
  'da',
  'sv',
  'nb',
  'fi',
  'hu',
  'af',
])

/**
 * Returns the correct font family map for a given BCP-47 language code.
 * Strips region subtags ('zh-TW' → 'zh', 'en-US' → 'en') before lookup.
 * Latin languages get the custom font; all others get undefined (OS system font).
 */
export function getFontFamilyForLanguage(language: string): ResolvedFontFamilyMap {
  const base = language.split('-')[0].toLowerCase()
  if (!LATIN_LANGUAGES.has(base)) {
    return systemFontFamilyMap
  }

  const useRuntimeAliases = typeof __DEV__ !== 'undefined' && __DEV__
  return useRuntimeAliases ? runtimeFontFamilyMap : fontFamilyMap
}
