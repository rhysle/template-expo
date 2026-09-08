import type { Theme } from '../types'

export const defaultTheme: Theme = {
  appearance: 'light', // Drives system UI content and blur treatments
  colors: {
    primary: {
      main: '#2563EB',
      strong: '#1D4ED8',
      soft: '#EFF6FF',
    },
    background: {
      base: '#F8FAFC',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      subtle: '#F1F5F9',
      overlay: 'rgba(15, 23, 42, 0.48)',
    },
    text: {
      primary: '#0F172A',
      secondary: '#334155',
      muted: '#64748B',
      accent: '#2563EB',
      inverse: '#FFFFFF',
      inverseSecondary: '#F8FAFC',
      inverseMuted: 'rgba(255, 255, 255, 0.72)',
    },
    status: {
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6',
      neutral: '#94A3B8',
    },
    border: {
      subtle: '#E2E8F0',
      default: '#CBD5E1',
      strong: '#94A3B8',
    },
    shadow: {
      base: '#0F172A',
    },
  },
}
