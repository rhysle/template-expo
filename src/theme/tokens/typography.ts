import { fontFamilyMap, type ResolvedFontFamilyMap } from '@/configs/fonts'

export const typography = {
  fontFamily: fontFamilyMap,
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 48,
  },
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const

// Omit the narrow inferred fontFamily type and replace with the widened variant
// so that useTheme() can inject either custom font or undefined (system font fallback).
// sizes and weights keep their exact literal types from `as const`.
export type Typography = Omit<typeof typography, 'fontFamily'> & {
  fontFamily: ResolvedFontFamilyMap
}
