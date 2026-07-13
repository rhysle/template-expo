import type { ThemeId } from '../types'
import { defaultTheme } from './default'

export { defaultTheme } from './default'

export const themes = {
  default: defaultTheme,
} as const

export const themeIds = Object.keys(themes) as ThemeId[]

export function isThemeId(value: string): value is ThemeId {
  return value in themes
}

export function getTheme(id: ThemeId) {
  return themes[id] ?? themes['default']
}
