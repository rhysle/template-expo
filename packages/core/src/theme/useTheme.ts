import { useCoreRuntime } from '@rhysle/core/runtime'
import { useThemeState } from '@rhysle/core/stores/features/theme'
import { useTranslation } from 'react-i18next'

import { getTheme } from './themes'
import { createShadows, radius, spacing, typography } from './tokens'
import type { ResolvedTheme } from './types'

export function useTheme(): ResolvedTheme {
  const runtime = useCoreRuntime()
  const { previewColors, themeId, setTheme } = useThemeState()
  const { i18n } = useTranslation()
  const theme = getTheme(runtime.themes, themeId)
  const colors = previewColors ?? theme.colors

  return {
    themeId,
    setTheme,
    appearance: theme.appearance,
    colors,
    spacing,
    typography: {
      ...typography,
      fontFamily: runtime.fonts.getFontFamilyForLanguage(i18n.language),
    },
    borderRadius: radius,
    shadows: createShadows(colors.shadow.base),
  }
}
