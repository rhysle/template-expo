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
  isPaywallShowing: boolean
  initAutoPaywallEnabled: () => void
  recordAutoPaywallShown: () => void
  setPaywallShowing: (showing: boolean) => void
}

export const paywallPersistExcludeKeys: ExcludeKeys<PaywallSlice> = ['isPaywallShowing']

export const createPaywallSlice = (
  set: (updater: (state: PaywallSlice) => void) => void
): PaywallSlice => ({
  autoPaywallEnabledAt: null,
  autoPaywallLastShownAt: null,
  isPaywallShowing: false,
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
  setPaywallShowing: (showing) =>
    set((state) => {
      state.isPaywallShowing = showing
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
      isPaywallShowing: paywall.isPaywallShowing,
      initAutoPaywallEnabled: paywall.initAutoPaywallEnabled,
      recordAutoPaywallShown: paywall.recordAutoPaywallShown,
      setPaywallShowing: paywall.setPaywallShowing,
    }))
  )
