import type { Theme } from '@shared/core/theme'
import { withAlpha } from '@shared/core/utils/color'

export const defaultTheme: Theme = {
  appearance: 'dark',
  colors: {
    primary: { main: '#FF6B78', strong: '#E84F66', soft: '#3A2024' },
    background: {
      base: '#131313',
      surface: '#171717',
      card: '#1A1A1A',
      subtle: '#242424',
      overlay: withAlpha('#000000', 0.8),
    },
    text: {
      primary: '#F5F5F7',
      secondary: '#C7C7CC',
      muted: '#909097',
      accent: '#FF6B78',
      inverse: '#171416',
      inverseSecondary: '#211A1C',
      inverseMuted: withAlpha('#171416', 0.72),
    },
    status: {
      success: '#68C28C',
      error: '#D92D20',
      warning: '#FFC66D',
      info: '#44D8F2',
      neutral: '#909097',
    },
    border: { subtle: '#2A2A2E', default: '#3B3B42', strong: '#BFC0C7' },
    shadow: { base: '#000000' },
  },
}
