import type { Theme } from '@shared/core/theme'
import { withAlpha } from '@shared/core/utils/color'

export const defaultTheme: Theme = {
  appearance: 'dark',
  colors: {
    primary: { main: '#B7EC76', strong: '#8CCC4F', soft: '#263420' },
    background: {
      base: '#090B10',
      surface: '#141820',
      card: '#1B2029',
      subtle: '#252B35',
      overlay: withAlpha('#000000', 0.8),
    },
    text: {
      primary: '#F4F6FA',
      secondary: '#C2C8D2',
      muted: '#818A99',
      accent: '#B7EC76',
      inverse: '#090B10',
      inverseSecondary: '#141820',
      inverseMuted: withAlpha('#090B10', 0.72),
    },
    status: {
      success: '#B7EC76',
      error: '#FF655E',
      warning: '#FFC66D',
      info: '#84B9FF',
      neutral: '#818A99',
    },
    border: { subtle: '#272D37', default: '#384150', strong: '#697587' },
    shadow: { base: '#000000' },
  },
}
