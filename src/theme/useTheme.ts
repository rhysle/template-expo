import { useTranslation } from 'react-i18next'

import { getFontFamilyForLanguage } from '@/configs/fonts'
import { useThemeState } from '@/stores/features/theme'

import { getTheme } from './themes'
import { createShadows, radius, spacing, typography } from './tokens'
import type { ResolvedTheme } from './types'

export function useTheme(): ResolvedTheme {
  const { themeId, setTheme } = useThemeState()
  const { i18n } = useTranslation()
  const theme = getTheme(themeId)

  return {
    themeId,
    setTheme,
    appearance: theme.appearance,
    colors: theme.colors,
    spacing,
    typography: {
      ...typography,
      fontFamily: getFontFamilyForLanguage(i18n.language),
    },
    borderRadius: radius,
    shadows: createShadows(theme.colors.shadow.base),
  }
}
