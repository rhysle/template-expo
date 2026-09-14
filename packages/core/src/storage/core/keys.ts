const registeredNamespaces = new Set<string>()

export const registerStorageNamespace = (namespace: string): void => {
  if (!__DEV__) return

  if (registeredNamespaces.has(namespace)) {
    console.error(`[storage] Duplicate namespace registered: "${namespace}"`)
    return
  }

  registeredNamespaces.add(namespace)
}

export const createNamespaceKey =
  <const N extends string>(namespace: N) =>
  (key: string): string => {
    return `${namespace}.${key}`
  }
