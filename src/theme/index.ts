import { getTheme } from './themes'
import { radius, shadows, spacing } from './tokens'
export type { ColorScheme, ResolvedTheme, Theme, ThemeId } from './types'

// Default theme colors for static usage (e.g. before provider); prefer useTheme() in components
// Utility functions (use tokens; for colors use theme from useTheme())

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
export { useTheme } from './useTheme'
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
