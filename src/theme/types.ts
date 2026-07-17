// Theme identifier; extend with 'system' | 'custom' later if needed
import type { TextStyle, ViewStyle } from 'react-native'

import type { Radius, Shadows, Spacing, Typography } from './tokens'

export type ThemeId = 'default'
export type ThemeAppearance = 'light' | 'dark'

// Semantic color structure per theme
export interface ColorScheme {
  primary: {
    main: string
    strong: string
    soft: string
  }
  background: {
    base: string
    surface: string
    card: string
    subtle: string
    overlay: string
  }
  text: {
    primary: string
    secondary: string
    muted: string
    accent: string
    inverse: string
    inverseSecondary: string
    inverseMuted: string
  }
  status: {
    success: string
    error: string
    warning: string
    info: string
    neutral: string
  }
  border: {
    subtle: string
    default: string
    strong: string
  }
  shadow: {
    base: string
  }
}

// Theme = colors; tokens (spacing, typography, etc.) are shared
export interface Theme {
  appearance: ThemeAppearance
  colors: ColorScheme
}

// Token types (inferred from token modules)

// Full resolved theme: theme id + setter + merged tokens and colors (what useTheme returns)
export interface ResolvedTheme {
  themeId: ThemeId
  setTheme: (id: ThemeId) => void
  appearance: ThemeAppearance
  colors: ColorScheme
  borderRadius: Radius
  shadows: Shadows
  spacing: Spacing
  typography: Typography
}

export type CommonStyles = {
  screen: ViewStyle
  container: ViewStyle
  card: ViewStyle
  text: TextStyle
  title: TextStyle
  subtitle: TextStyle
  body: TextStyle
  caption: TextStyle
}
