import type { Theme, ThemeId } from '../types'
export const getTheme = (themes: Record<ThemeId, Theme>, id: ThemeId): Theme =>
  themes[id] ?? themes.default
