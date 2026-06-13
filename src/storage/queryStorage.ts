import type { PersistStorage } from './core/contracts'
import { storage } from './core/engine'
import { createNamespaceKey, registerStorageNamespace } from './core/keys'

const QUERY_NAMESPACE = 'query'
registerStorageNamespace(QUERY_NAMESPACE)
const key = createNamespaceKey(QUERY_NAMESPACE)

export const buildQueryKey = (storeName: string): string => key(storeName)

export const queryStorage: PersistStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return storage.getString(buildQueryKey(key)) ?? null
    } catch (error) {
      console.warn('Failed to read persisted query cache:', error)
      return null
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      storage.set(buildQueryKey(key), value)
    } catch (error) {
      console.warn('Failed to persist query cache:', error)
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      storage.remove(buildQueryKey(key))
    } catch (error) {
      console.warn('Failed to remove persisted query cache:', error)
    }
  },
}
