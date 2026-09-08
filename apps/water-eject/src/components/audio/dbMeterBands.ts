import type { MeterBand } from '@/services/audio'
import type { ColorScheme } from '@/theme'

export const getDbMeterBandColors = (colors: ColorScheme): Record<MeterBand, string> => ({
  veryQuiet: colors.primary.main,
  normal: colors.status.success,
  loud: colors.status.warning,
  danger: colors.status.error,
})
