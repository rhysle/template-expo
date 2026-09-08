export type FontWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold'
export type FontFamilyMap = Record<FontWeight, string>
export type ResolvedFontFamilyMap = FontFamilyMap | Record<FontWeight, undefined>
export interface FoundationFonts {
  fontFamilyMap: FontFamilyMap
  runtimeFontFamilyMap: FontFamilyMap
  getFontFamilyForLanguage: (language: string) => ResolvedFontFamilyMap
}
