import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    otaUpdate: OtaUpdateSlice
  }
}

export interface OtaUpdateSlice {
  lastAppliedUpdateId: string | null
  setLastAppliedUpdateId: (id: string) => void
}

// lastAppliedUpdateId is intentionally NOT excluded from persistence.
// It must survive app restarts so we can detect whether a new OTA was applied
// on the next cold start by comparing it to Updates.updateId.
export const otaUpdatePersistExcludeKeys: ExcludeKeys<OtaUpdateSlice> = []

export const createOtaUpdateSlice = (
  set: (updater: (state: OtaUpdateSlice) => void) => void
): OtaUpdateSlice => ({
  lastAppliedUpdateId: null,
  setLastAppliedUpdateId: (id) =>
    set((state) => {
      state.lastAppliedUpdateId = id
    }),
})

export const sliceConfig = {
  create: createOtaUpdateSlice,
  persistExcludeKeys: otaUpdatePersistExcludeKeys,
} satisfies SliceConfig<OtaUpdateSlice>

export const useOtaUpdateState = () =>
  getUseAppStore()(
    useShallow(({ otaUpdate }) => ({
      lastAppliedUpdateId: otaUpdate.lastAppliedUpdateId,
      setLastAppliedUpdateId: otaUpdate.setLastAppliedUpdateId,
    }))
  )
