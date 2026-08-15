import { storage } from './core/engine'
import { createNamespaceKey, registerStorageNamespace } from './core/keys'

const DEBUG_NAMESPACE = 'debug'
const LANGUAGE_OVERRIDE_KEY = 'languageOverride'

registerStorageNamespace(DEBUG_NAMESPACE)
const key = createNamespaceKey(DEBUG_NAMESPACE)

export const getDebugLanguageOverride = (): string | null => {
  if (!__DEV__) return null

  return storage.getString(key(LANGUAGE_OVERRIDE_KEY)) ?? null
}

export const setDebugLanguageOverride = (language: string | null): void => {
  if (!__DEV__) return

  if (language === null) {
    storage.remove(key(LANGUAGE_OVERRIDE_KEY))
    return
  }

  storage.set(key(LANGUAGE_OVERRIDE_KEY), language)
}
