import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    appReview: AppReviewSlice
  }
}

export interface AppReviewSlice {
  appReviewActionCount: number
  appReviewLastRequestedAt: number | null
  incrementActionCount: () => void
  recordReviewRequested: () => void
  resetAppReview: () => void
}

export const appReviewPersistExcludeKeys: ExcludeKeys<AppReviewSlice> = []

export const createAppReviewSlice = (
  set: (updater: (state: AppReviewSlice) => void) => void
): AppReviewSlice => ({
  appReviewActionCount: 0,
  appReviewLastRequestedAt: null,
  incrementActionCount: () =>
    set((state) => {
      state.appReviewActionCount += 1
    }),
  recordReviewRequested: () =>
    set((state) => {
      state.appReviewLastRequestedAt = Date.now()
      state.appReviewActionCount = 0
    }),
  resetAppReview: () =>
    set((state) => {
      state.appReviewActionCount = 0
      state.appReviewLastRequestedAt = null
    }),
})

export const sliceConfig = {
  create: createAppReviewSlice,
  persistExcludeKeys: appReviewPersistExcludeKeys,
} satisfies SliceConfig<AppReviewSlice>

export const useAppReviewState = () =>
  getUseAppStore()(
    useShallow(({ appReview }) => ({
      appReviewActionCount: appReview.appReviewActionCount,
      appReviewLastRequestedAt: appReview.appReviewLastRequestedAt,
      incrementActionCount: appReview.incrementActionCount,
      recordReviewRequested: appReview.recordReviewRequested,
      resetAppReview: appReview.resetAppReview,
    }))
  )
