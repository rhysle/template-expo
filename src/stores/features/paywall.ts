import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    paywall: PaywallSlice
  }
}

export interface PaywallSlice {
  autoPaywallEnabledAt: number | null
  autoPaywallLastShownAt: number | null
  isAutoPaywallShowing: boolean
  initAutoPaywallEnabled: () => void
  recordAutoPaywallShown: () => void
  setAutoPaywallShowing: (showing: boolean) => void
}

export const paywallPersistExcludeKeys: ExcludeKeys<PaywallSlice> = ['isAutoPaywallShowing']

export const createPaywallSlice = (
  set: (updater: (state: PaywallSlice) => void) => void
): PaywallSlice => ({
  autoPaywallEnabledAt: null,
  autoPaywallLastShownAt: null,
  isAutoPaywallShowing: false,
  initAutoPaywallEnabled: () =>
    set((state) => {
      if (state.autoPaywallEnabledAt === null) {
        state.autoPaywallEnabledAt = Date.now()
      }
    }),
  recordAutoPaywallShown: () =>
    set((state) => {
      state.autoPaywallLastShownAt = Date.now()
    }),
  setAutoPaywallShowing: (showing) =>
    set((state) => {
      state.isAutoPaywallShowing = showing
    }),
})

export const sliceConfig = {
  create: createPaywallSlice,
  persistExcludeKeys: paywallPersistExcludeKeys,
} satisfies SliceConfig<PaywallSlice>

export const usePaywallState = () =>
  getUseAppStore()(
    useShallow(({ paywall }) => ({
      autoPaywallEnabledAt: paywall.autoPaywallEnabledAt,
      autoPaywallLastShownAt: paywall.autoPaywallLastShownAt,
      isAutoPaywallShowing: paywall.isAutoPaywallShowing,
      initAutoPaywallEnabled: paywall.initAutoPaywallEnabled,
      recordAutoPaywallShown: paywall.recordAutoPaywallShown,
      setAutoPaywallShowing: paywall.setAutoPaywallShowing,
    }))
  )
