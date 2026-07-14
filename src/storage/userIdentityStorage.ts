import { storage } from './core/engine'
import { createNamespaceKey, registerStorageNamespace } from './core/keys'

const USER_IDENTITY_NAMESPACE = 'userIdentity'

registerStorageNamespace(USER_IDENTITY_NAMESPACE)
const key = createNamespaceKey(USER_IDENTITY_NAMESPACE)

export const getStoredUserId = (appVariant: string): string | null => {
  return storage.getString(key(appVariant)) ?? null
}

export const setStoredUserId = (appVariant: string, userId: string): void => {
  storage.set(key(appVariant), userId)
}

export const removeStoredUserId = (appVariant: string): void => {
  storage.remove(key(appVariant))
}
