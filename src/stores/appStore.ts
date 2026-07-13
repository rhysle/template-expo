import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { storeStorage } from '@/storage'

import {
  AppPersistedState,
  createAppSlices,
  migratePersistedState,
  selectPersistedState,
  STORE_VERSION,
} from './slices'

export const APP_STATE_PERSIST_NAME = 'state'

export type AppStore = AppSlices
export type AppStorePersistedState = AppPersistedState

export const useAppStore = create<AppSlices>()(
  persist(
    immer((set, get) => createAppSlices(set, get)),
    {
      name: APP_STATE_PERSIST_NAME,
      storage: createJSONStorage(() => storeStorage),
      partialize: selectPersistedState,
      version: STORE_VERSION,
      migrate: migratePersistedState,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Record<string, unknown>
        const result = { ...currentState } as Record<string, unknown>
        for (const [key, value] of Object.entries(persisted)) {
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            key in result
          ) {
            // Per-slice deep merge: overlay persisted data onto current slice,
            // preserving actions and default values for non-persisted fields.
            result[key] = { ...(result[key] as object), ...(value as object) }
          } else {
            result[key] = value
          }
        }
        return result as unknown as AppSlices
      },
    }
  )
)
