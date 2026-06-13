import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

// Per-variant key prevents IDs leaking between dev/preview/production
// analytics and RevenueCat customers under a shared bundle ID.
const STORAGE_KEY = `user.identity.${process.env.APP_VARIANT ?? 'development'}`

/**
 * Returns the existing anonymous user ID from SecureStore, or generates a new
 * UUID, persists it, and returns it.
 *
 * On iOS, SecureStore uses the Keychain - the value survives app uninstall.
 * On Android, SecureStore uses EncryptedSharedPreferences - reset on uninstall
 * (acceptable; purchase restoration works independently via store receipts).
 */
export const getOrCreateUserId = async (): Promise<string> => {
  try {
    const existing = await SecureStore.getItemAsync(STORAGE_KEY)
    if (existing) return existing
  } catch {
    // Read failure - fall through to generate a new ID for this session.
  }

  const newId = Crypto.randomUUID()

  try {
    await SecureStore.setItemAsync(STORAGE_KEY, newId)
  } catch (error) {
    if (__DEV__) {
      console.warn('[userIdentity] Failed to persist user ID to SecureStore:', error)
    }
  }

  return newId
}

/**
 * Deletes the persisted user ID from SecureStore.
 * Intended for dev/debug use only - the next cold launch will generate a new ID.
 */
export const clearUserId = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(STORAGE_KEY)
}
