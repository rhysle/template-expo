// Theme identifier; extend with 'system' | 'custom' later if needed
import type { TextStyle, ViewStyle } from 'react-native'

import type { Radius, Shadows, Spacing, Typography } from './tokens'

export type ThemeId = 'default'

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
    overlay: string
  }
  text: {
    primary: string
    secondary: string
    muted: string
    accent: string
    inverse: string // dark primary text for light/colored surfaces
    inverseSecondary: string // dark secondary text
    inverseMuted: string // dark muted text / placeholders (alpha-based)
  }
  status: {
    success: string
    error: string
    warning: string
    neutral: string
    favorite: string
  }
  border: {
    subtle: string // ~8% white - card edges, faint dividers
    default: string // ~14% white - inputs, list separators
    strong: string // ~28% white - focused states, selected items
  }
  shadow: {
    base: string
  }
}

// Theme = colors; tokens (spacing, typography, etc.) are shared
export interface Theme {
  colors: ColorScheme
}

// Token types (inferred from token modules)

// Full resolved theme: theme id + setter + merged tokens and colors (what useTheme returns)
export interface ResolvedTheme {
  themeId: ThemeId
  setTheme: (id: ThemeId) => void
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
