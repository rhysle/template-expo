import type { ColorScheme } from '@/theme'
import { withAlpha } from '@/utils/color'

export type ComponentTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info'

export const getComponentToneColor = (colors: ColorScheme, tone: ComponentTone): string => {
  const toneColors: Record<ComponentTone, string> = {
    neutral: colors.status.neutral,
    accent: colors.primary.main,
    success: colors.status.success,
    warning: colors.status.warning,
    error: colors.status.error,
    info: colors.status.info,
  }

  return toneColors[tone]
}

export const getComponentToneSurface = (colors: ColorScheme, tone: ComponentTone): string => {
  if (tone === 'neutral') return colors.background.subtle
  if (tone === 'accent') return colors.primary.soft

  return withAlpha(getComponentToneColor(colors, tone), 0.08)
}
