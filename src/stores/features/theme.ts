import { useShallow } from 'zustand/react/shallow'

import type { ThemeId } from '@/theme/types'

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
  setTheme: (themeId: ThemeId) => void
  toggleTheme: () => void
}

export const themePersistExcludeKeys: ExcludeKeys<ThemeSlice> = []

export const createThemeSlice = (
  set: (updater: (state: ThemeSlice) => void) => void
): ThemeSlice => ({
  themeId: DEFAULT_THEME_ID,
  setTheme: (themeId) =>
    set((state) => {
      state.themeId = themeId
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
      setTheme: theme.setTheme,
      toggleTheme: theme.toggleTheme,
    }))
  )
