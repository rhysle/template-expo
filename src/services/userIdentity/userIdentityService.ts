import * as Crypto from 'expo-crypto'

import { recordError } from '@/services/sentry'
import { getStoredUserId, removeStoredUserId, setStoredUserId } from '@/storage'

// Keep the storage key variant-specific in addition to the native app sandbox boundary.
const appVariant = __DEV__ ? 'development' : 'production'

/**
 * Returns the current installation's anonymous user ID from MMKV, or generates
 * and persists a new UUID. Uninstalling the app removes the ID on both platforms.
 */
export const getOrCreateUserId = async (): Promise<string> => {
  try {
    const existingId = getStoredUserId(appVariant)
    if (existingId) return existingId
  } catch (error) {
    recordError(error, 'userIdentity.getOrCreateUserId.read')
  }

  const newId = Crypto.randomUUID()

  try {
    setStoredUserId(appVariant, newId)
  } catch (error) {
    recordError(error, 'userIdentity.getOrCreateUserId.write')
  }

  return newId
}

/**
 * Deletes the persisted user ID from MMKV.
 * Intended for dev/debug use only - the next cold launch will generate a new ID.
 */
export const clearUserId = async (): Promise<void> => {
  removeStoredUserId(appVariant)
}
