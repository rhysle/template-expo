import type { StateStorage } from 'zustand/middleware'

import { storage } from './core/engine'
import { createNamespaceKey, registerStorageNamespace } from './core/keys'

const ZUSTAND_NAMESPACE = 'zustand'
registerStorageNamespace(ZUSTAND_NAMESPACE)
const key = createNamespaceKey(ZUSTAND_NAMESPACE)

export const buildStoreKey = (storeName: string): string => key(storeName)

export const storeStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return storage.getString(buildStoreKey(name)) ?? null
    } catch (error) {
      console.warn('Failed to read persisted app state:', error)
      return null
    }
  },

  setItem: (name: string, value: string): void => {
    try {
      storage.set(buildStoreKey(name), value)
    } catch (error) {
      console.warn('Failed to persist app state:', error)
    }
  },

  removeItem: (name: string): void => {
    try {
      storage.remove(buildStoreKey(name))
    } catch (error) {
      console.warn('Failed to remove persisted app state:', error)
    }
  },
}
