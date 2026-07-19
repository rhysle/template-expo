import { useTranslation } from 'react-i18next'

import { getFontFamilyForLanguage } from '@/configs/fonts'
import { useThemeState } from '@/stores/features/theme'

import { getTheme } from './themes'
import { createShadows, radius, spacing, typography } from './tokens'
import type { ResolvedTheme } from './types'

export function useTheme(): ResolvedTheme {
  const { previewColors, themeId, setTheme } = useThemeState()
  const { i18n } = useTranslation()
  const theme = getTheme(themeId)
  const colors = previewColors ?? theme.colors

  return {
    themeId,
    setTheme,
    appearance: theme.appearance,
    colors,
    spacing,
    typography: {
      ...typography,
      fontFamily: getFontFamilyForLanguage(i18n.language),
    },
    borderRadius: radius,
    shadows: createShadows(colors.shadow.base),
  }
}
