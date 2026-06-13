// Default theme colors for static usage (e.g. before provider); prefer useTheme() in components
// Utility functions (use tokens; for colors use theme from useTheme())
import { useTranslation } from 'react-i18next'

import { getFontFamilyForLanguage } from '@/configs/fonts'
import { useThemeState } from '@/stores/features/theme'

import { getTheme } from './themes'
import { radius, shadows, spacing, typography } from './tokens'
import type { ResolvedTheme } from './types'
export type { ColorScheme, ResolvedTheme, Theme, ThemeId } from './types'

// Tokens (shared across themes)
export type { IconSize, Radius, Shadows, Spacing, Typography } from './tokens'
export { iconSizes, radius, shadows, spacing, typography } from './tokens'

// Backward-compatible token names
export {
  radius as borderRadiusConfig,
  shadows as shadowsConfig,
  spacing as spacingConfig,
  typography as typographyConfig,
} from './tokens'

// Themes
export { defaultTheme, getTheme, themes } from './themes'

// Context and hooks
export { createThemedStyles, getCommonStyles, useCommonStyles, useThemedStyles } from './styles'
export const colors = getTheme('default').colors

export function getBorderRadius(size: keyof typeof radius) {
  return radius[size]
}

export function getShadow(type: keyof typeof shadows) {
  return shadows[type]
}

export function getSpacing(size: keyof typeof spacing) {
  return spacing[size]
}

export function useTheme() {
  const { themeId, setTheme } = useThemeState()
  const { i18n } = useTranslation()
  const theme = getTheme(themeId)

  const resolvedTheme: ResolvedTheme = {
    themeId,
    setTheme,
    colors: theme.colors,
    spacing,
    typography: {
      ...typography,
      fontFamily: getFontFamilyForLanguage(i18n.language),
    },
    borderRadius: radius,
    shadows,
  }

  return resolvedTheme
}
