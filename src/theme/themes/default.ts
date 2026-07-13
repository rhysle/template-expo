import type { Theme } from '../types'

export const defaultTheme: Theme = {
  colors: {
    primary: {
      main: '#58b895',
      strong: '#2aa87d',
      soft: '#7dcbac',
    },
    background: {
      base: '#0e0e0e',
      surface: '#1f1f1f',
      card: '#131313',
      overlay: 'rgba(0, 0, 0, 0.8)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#ababab',
      muted: '#757575',
      accent: '#58b895',
      inverse: '#0a0a0a',
      inverseSecondary: '#3a3a3a',
      inverseMuted: 'rgba(0, 0, 0, 0.45)',
    },
    status: {
      success: '#6ecfb0',
      error: '#ff7351',
      warning: '#FFA726',
      neutral: '#757575',
      favorite: '#FFD700',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.08)',
      default: 'rgba(255, 255, 255, 0.14)',
      strong: 'rgba(255, 255, 255, 0.28)',
    },
    shadow: {
      base: '#000000',
    },
  },
}
