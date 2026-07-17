import type { Theme } from '../types'

export const defaultTheme: Theme = {
  appearance: 'light', // Drives system UI content and blur treatments
  colors: {
    primary: {
      main: '#2563EB', // Primary actions, selected controls, and active indicators
      strong: '#1D4ED8', // Pressed and emphasized primary states
      soft: '#EFF6FF', // Subtle primary highlights and selected backgrounds
    },
    background: {
      base: '#F8FAFC', // Screen and page background
      surface: '#FFFFFF', // Sheets, navigation, and raised content surfaces
      card: '#FFFFFF', // Default card background
      subtle: '#F1F5F9', // Inactive controls and nested sections
      overlay: 'rgba(15, 23, 42, 0.48)', // Scrim behind modals and sheets
    },
    text: {
      primary: '#0F172A', // Headings and primary body content
      secondary: '#334155', // Supporting copy and secondary labels
      muted: '#64748B', // Placeholders, metadata, and de-emphasized content
      accent: '#2563EB', // Interactive text and highlighted values
      inverse: '#FFFFFF', // Primary text on colored or dark surfaces
      inverseSecondary: '#F8FAFC', // Supporting text on colored or dark surfaces
      inverseMuted: 'rgba(255, 255, 255, 0.72)', // De-emphasized text on colored surfaces
    },
    status: {
      success: '#22C55E', // Success icons, indicators, and borders
      error: '#EF4444', // Error icons, indicators, and borders
      warning: '#F59E0B', // Warning icons, indicators, and borders
      info: '#3B82F6', // Informational icons, indicators, and borders
      neutral: '#94A3B8', // Neutral icons, indicators, and borders
    },
    border: {
      subtle: '#E2E8F0', // Faint dividers and low-emphasis boundaries
      default: '#CBD5E1', // Inputs, cards, and standard separators
      strong: '#94A3B8', // Selected, focused, and emphasized boundaries
    },
    shadow: {
      base: '#0F172A', // Base tint used to compose all elevation shadows
    },
  },
}
