export interface PersistStorage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export interface SyncKVStorage<T> {
  get: () => T | null
  set: (value: T) => void
  remove: () => void
}
