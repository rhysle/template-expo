import type { Icon } from 'phosphor-react-native'
import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    snackbar: SnackbarSlice
  }
}

export type SnackbarVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'neutral'

export type SnackbarAction = {
  label: string
  onPress: () => void
}

export type SnackbarPayload = {
  title: string
  subtitle?: string
  variant?: SnackbarVariant
  icon?: Icon | null
  durationMs?: number
  action?: SnackbarAction
  bottomOffset?: number
  showAccent?: boolean
  showShadow?: boolean
  blur?: boolean
  blurIntensity?: number
}

export type SnackbarState = {
  title: string
  subtitle?: string
  variant: SnackbarVariant
  icon?: Icon | null
  durationMs: number
  action?: SnackbarAction
  bottomOffset: number
  showAccent: boolean
  showShadow: boolean
  blur: boolean
  blurIntensity: number
}

export interface SnackbarSlice {
  snackbar: SnackbarState | null
  showSnackbar: (payload: SnackbarPayload) => void
  hideSnackbar: () => void
}

export const snackbarPersistExcludeKeys: ExcludeKeys<SnackbarSlice> = ['snackbar']

const DEFAULT_DURATION_MS = 4000

export const createSnackbarSlice = (
  set: (updater: (state: SnackbarSlice) => void) => void,
  _get: () => SnackbarSlice
): SnackbarSlice => ({
  snackbar: null,
  showSnackbar: (payload) =>
    set((state) => {
      state.snackbar = {
        title: payload.title,
        subtitle: payload.subtitle,
        variant: payload.variant ?? 'default',
        icon: payload.icon,
        durationMs: payload.durationMs ?? DEFAULT_DURATION_MS,
        action: payload.action,
        bottomOffset: payload.bottomOffset ?? 0,
        showAccent: payload.showAccent ?? false,
        showShadow: payload.showShadow ?? true,
        blur: payload.blur ?? true,
        blurIntensity: payload.blurIntensity ?? 60,
      }
    }),
  hideSnackbar: () =>
    set((state) => {
      state.snackbar = null
    }),
})

export const sliceConfig = {
  create: createSnackbarSlice,
  persistExcludeKeys: snackbarPersistExcludeKeys,
} satisfies SliceConfig<SnackbarSlice>

export const useSnackbarState = () =>
  getUseAppStore()(
    useShallow(({ snackbar }) => ({
      snackbar: snackbar.snackbar,
      showSnackbar: snackbar.showSnackbar,
      hideSnackbar: snackbar.hideSnackbar,
    }))
  )
