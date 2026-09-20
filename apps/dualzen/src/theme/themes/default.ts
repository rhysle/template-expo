import type { Theme } from '@shared/core/theme'
import { withAlpha } from '@shared/core/utils/color'

export const defaultTheme: Theme = {
  appearance: 'dark',
  colors: {
    primary: { main: '#D9A441', strong: '#B8832E', soft: '#3A2E19' },
    background: {
      base: '#131313',
      surface: '#171717',
      card: '#1A1A1A',
      subtle: '#242424',
      overlay: withAlpha('#000000', 0.8),
    },
    text: {
      primary: '#F4F6FA',
      secondary: '#C4C4C4',
      muted: '#858585',
      accent: '#E7BA63',
      inverse: '#131313',
      inverseSecondary: '#1A1A1A',
      inverseMuted: withAlpha('#131313', 0.72),
    },
    status: {
      success: '#68C28C',
      error: '#FF655E',
      warning: '#FFC66D',
      info: '#84B9FF',
      neutral: '#858585',
    },
    border: { subtle: '#292929', default: '#3A3A3A', strong: '#686868' },
    shadow: { base: '#000000' },
  },
}
