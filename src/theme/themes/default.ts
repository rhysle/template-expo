import type { Theme } from '../types'

export const defaultTheme: Theme = {
  appearance: 'light', // Drives system UI content and blur treatments
  colors: {
    primary: {
      main: '#21A0FF',
      strong: '#0077C8',
      soft: '#E6F5FF',
    },
    background: {
      base: '#F7FBFF',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      subtle: '#EEF7FD',
      overlay: 'rgba(8, 35, 54, 0.48)',
    },
    text: {
      primary: '#102A43',
      secondary: '#35546A',
      muted: '#5F7A8C',
      accent: '#0077C8',
      inverse: '#FFFFFF',
      inverseSecondary: '#F3FAFF',
      inverseMuted: 'rgba(255, 255, 255, 0.72)',
    },
    status: {
      success: '#00AE75',
      error: '#C73545',
      warning: '#E08200',
      info: '#0F80C5',
      neutral: '#7391A3',
    },
    border: {
      subtle: '#DCEAF3',
      default: '#C7DBE6',
      strong: '#8BA8BC',
    },
    shadow: {
      base: '#0B2538',
    },
  },
}
