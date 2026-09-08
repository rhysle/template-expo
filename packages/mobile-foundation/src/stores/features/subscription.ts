import { useShallow } from 'zustand/react/shallow'

import { useFoundationStore } from '../binding'
import type { ExcludeKeys, SliceConfig } from '../slices/types'

export type PremiumState = 'loading' | 'free' | 'premium' | 'unknown'

export interface SubscriptionSlice {
  premiumState: PremiumState
  activeEntitlementId: string | null
  setPremiumStatus: (state: PremiumState, entitlementId: string | null) => void
}

export const subscriptionPersistExcludeKeys: ExcludeKeys<SubscriptionSlice> = [
  'premiumState',
  'activeEntitlementId',
]

export const createSubscriptionSlice = (
  set: (updater: (state: SubscriptionSlice) => void) => void
): SubscriptionSlice => ({
  premiumState: 'loading',
  activeEntitlementId: null,
  setPremiumStatus: (premiumState, entitlementId) =>
    set((state) => {
      state.premiumState = premiumState
      state.activeEntitlementId = entitlementId
    }),
})

export const sliceConfig = {
  create: createSubscriptionSlice,
  persistExcludeKeys: subscriptionPersistExcludeKeys,
} satisfies SliceConfig<SubscriptionSlice>

export const useSubscriptionState = () =>
  useFoundationStore(
    useShallow(({ subscription }) => ({
      premiumState: subscription.premiumState,
      activeEntitlementId: subscription.activeEntitlementId,
      setPremiumStatus: subscription.setPremiumStatus,
    }))
  )
