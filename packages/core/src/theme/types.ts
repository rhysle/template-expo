// Theme identifier; extend with 'system' | 'custom' later if needed
import type { TextStyle, ViewStyle } from 'react-native'

import type { Radius, Shadows, Spacing, Typography } from './tokens'

export type ThemeId = 'default'
export type ThemeAppearance = 'light' | 'dark'

// Semantic color structure per theme
export interface ColorScheme {
  primary: {
    /** Primary actions, selected controls, and active indicators. */
    main: string
    /** Pressed and emphasized primary states. */
    strong: string
    /** Subtle primary highlights and selected backgrounds. */
    soft: string
  }
  background: {
    /** Screen and page background. */
    base: string
    /** Sheets, navigation, and raised content surfaces. */
    surface: string
    /** Default card background. */
    card: string
    /** Inactive controls and nested sections. */
    subtle: string
    /** Scrim behind modals and sheets. */
    overlay: string
  }
  text: {
    /** Headings and primary body content. */
    primary: string
    /** Supporting copy and secondary labels. */
    secondary: string
    /** Placeholders, metadata, and de-emphasized content. */
    muted: string
    /** Interactive text and highlighted values. */
    accent: string
    /** Primary text on colored or dark surfaces. */
    inverse: string
    /** Supporting text on colored or dark surfaces. */
    inverseSecondary: string
    /** De-emphasized text on colored surfaces. */
    inverseMuted: string
  }
  status: {
    /** Success icons, indicators, and borders. */
    success: string
    /** Error icons, indicators, and borders. */
    error: string
    /** Warning icons, indicators, and borders. */
    warning: string
    /** Informational icons, indicators, and borders. */
    info: string
    /** Neutral icons, indicators, and borders. */
    neutral: string
  }
  border: {
    /** Faint dividers and low-emphasis boundaries. */
    subtle: string
    /** Inputs, cards, and standard separators. */
    default: string
    /** Selected, focused, and emphasized boundaries. */
    strong: string
  }
  shadow: {
    /** Base tint used to compose all elevation shadows. */
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
