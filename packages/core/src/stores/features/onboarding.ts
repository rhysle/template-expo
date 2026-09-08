import { useShallow } from 'zustand/react/shallow'

import { useCoreStore } from '../binding'
import type { ExcludeKeys, SliceConfig } from '../slices/types'

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
  useCoreStore(
    useShallow(({ onboarding }) => ({
      hasCompletedOnboarding: onboarding.hasCompletedOnboarding,
      completeOnboarding: onboarding.completeOnboarding,
      resetOnboarding: onboarding.resetOnboarding,
    }))
  )
