import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    onboarding: OnboardingSlice
  }
}

export interface OnboardingSlice {
  hasCompletedOnboarding: boolean
  completeOnboarding: () => void
  resetOnboarding: () => void
}

export const onboardingPersistExcludeKeys: ExcludeKeys<OnboardingSlice> = []

export const createOnboardingSlice = (
  set: (updater: (state: OnboardingSlice) => void) => void
): OnboardingSlice => ({
  hasCompletedOnboarding: false,
  completeOnboarding: () =>
    set((state) => {
      state.hasCompletedOnboarding = true
    }),
  resetOnboarding: () =>
    set((state) => {
      state.hasCompletedOnboarding = false
    }),
})

export const sliceConfig = {
  create: createOnboardingSlice,
  persistExcludeKeys: onboardingPersistExcludeKeys,
} satisfies SliceConfig<OnboardingSlice>

export const useOnboardingState = () =>
  getUseAppStore()(
    useShallow(({ onboarding }) => ({
      hasCompletedOnboarding: onboarding.hasCompletedOnboarding,
      completeOnboarding: onboarding.completeOnboarding,
      resetOnboarding: onboarding.resetOnboarding,
    }))
  )
