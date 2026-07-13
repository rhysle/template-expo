import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    subscription: SubscriptionSlice
  }
}

export interface SubscriptionSlice {
  isSubscribed: boolean
  activeEntitlementId: string | null
  revenueCatReady: boolean
  setSubscriptionStatus: (isActive: boolean, entitlementId: string | null) => void
  setRevenueCatReady: (ready: boolean) => void
}

export const subscriptionPersistExcludeKeys: ExcludeKeys<SubscriptionSlice> = [
  'isSubscribed',
  'activeEntitlementId',
  'revenueCatReady',
]

export const createSubscriptionSlice = (
  set: (updater: (state: SubscriptionSlice) => void) => void
): SubscriptionSlice => ({
  isSubscribed: false,
  activeEntitlementId: null,
  revenueCatReady: false,
  setSubscriptionStatus: (isActive, entitlementId) =>
    set((state) => {
      state.isSubscribed = isActive
      state.activeEntitlementId = entitlementId
    }),
  setRevenueCatReady: (ready) =>
    set((state) => {
      state.revenueCatReady = ready
    }),
})

export const sliceConfig = {
  create: createSubscriptionSlice,
  persistExcludeKeys: subscriptionPersistExcludeKeys,
} satisfies SliceConfig<SubscriptionSlice>

export const useSubscriptionState = () =>
  getUseAppStore()(
    useShallow(({ subscription }) => ({
      isSubscribed: subscription.isSubscribed,
      activeEntitlementId: subscription.activeEntitlementId,
      revenueCatReady: subscription.revenueCatReady,
      setSubscriptionStatus: subscription.setSubscriptionStatus,
      setRevenueCatReady: subscription.setRevenueCatReady,
    }))
  )
