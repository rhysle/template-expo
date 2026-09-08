import { storeStorage } from '@rhysle/core/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { type AnySliceConfig, createSliceRegistry } from './slices/registry'

export const APP_STATE_PERSIST_NAME = 'state'

export const createAppStore = <T extends object>(modules: Record<string, AnySliceConfig>) => {
  const { createAppSlices, migratePersistedState, STORE_VERSION, selectPersistedState } =
    createSliceRegistry<T>(modules)
  return create<T>()(
    persist(
      immer((set, get) => createAppSlices(set as (updater: (state: T) => void) => void, get)),
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
          return result as unknown as T
        },
      }
    )
  )
}
