import { useShallow } from 'zustand/react/shallow'

import type { ColorScheme, ThemeId } from '@/theme/types'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    theme: ThemeSlice
  }
}

const DEFAULT_THEME_ID: ThemeId = 'default'

export interface ThemeSlice {
  themeId: ThemeId
  previewColors: ColorScheme | null
  setTheme: (themeId: ThemeId) => void
  setPreviewColors: (colors: ColorScheme | null) => void
  toggleTheme: () => void
}

export const themePersistExcludeKeys: ExcludeKeys<ThemeSlice> = ['previewColors']

export const createThemeSlice = (
  set: (updater: (state: ThemeSlice) => void) => void
): ThemeSlice => ({
  themeId: DEFAULT_THEME_ID,
  previewColors: null,
  setTheme: (themeId) =>
    set((state) => {
      state.themeId = themeId
    }),
  setPreviewColors: (colors) =>
    set((state) => {
      state.previewColors = colors
    }),
  toggleTheme: () =>
    set((state) => {
      // For future-proofing when more themes are added, toggle will just switch to the next theme in the list
      state.themeId = state.themeId
    }),
})

export const sliceConfig = {
  create: createThemeSlice,
  persistExcludeKeys: themePersistExcludeKeys,
} satisfies SliceConfig<ThemeSlice>

export const useThemeState = () =>
  getUseAppStore()(
    useShallow(({ theme }) => ({
      themeId: theme.themeId,
      previewColors: theme.previewColors,
      setTheme: theme.setTheme,
      setPreviewColors: theme.setPreviewColors,
      toggleTheme: theme.toggleTheme,
    }))
  )
