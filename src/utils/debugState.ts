import { QUERY_STATE_PERSIST_KEY } from '@/services/queries'
import { storage } from '@/storage/core/engine'
import { buildQueryKey } from '@/storage/queryStorage'
import { buildStoreKey } from '@/storage/storeStorage'
import { APP_STATE_PERSIST_NAME, useAppStore } from '@/stores'
import { SLICE_VERSIONS_KEY } from '@/stores/slices/migrate'

const ZUSTAND_KEY = buildStoreKey(APP_STATE_PERSIST_NAME)
const QUERY_KEY = buildQueryKey(QUERY_STATE_PERSIST_KEY)

// ── Storage entries ──

export type StorageEntry = {
  key: string
  value: unknown
  rawSize: number
}

export const getAllStorageEntries = (): StorageEntry[] => {
  const keys = storage.getAllKeys()
  return keys.map((key) => {
    const raw = storage.getString(key)
    if (raw == null) return { key, value: null, rawSize: 0 }
    try {
      return { key, value: JSON.parse(raw), rawSize: raw.length }
    } catch {
      return { key, value: raw, rawSize: raw.length }
    }
  })
}

// ── Zustand state ──

type ZustandPersistWrapper = {
  state: Record<string, unknown>
  version: number
}

export const getRawPersistedZustandState = (): Record<string, unknown> | null => {
  const raw = storage.getString(ZUSTAND_KEY)
  if (raw == null) return null
  try {
    const wrapper = JSON.parse(raw) as ZustandPersistWrapper
    return wrapper.state ?? null
  } catch {
    return null
  }
}

export const getLiveZustandState = (): Record<string, unknown> => {
  const state = useAppStore.getState() as unknown as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state)) {
    if (key === SLICE_VERSIONS_KEY) {
      result[key] = value
      continue
    }
    if (typeof value === 'object' && value !== null) {
      result[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v !== 'function')
      )
    } else if (typeof value !== 'function') {
      result[key] = value
    }
  }
  return result
}

// ── Query state ──

export const getRawPersistedQueryState = (): unknown | null => {
  const raw = storage.getString(QUERY_KEY)
  if (raw == null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ── Diff ──

export type DiffStatus = 'same' | 'changed' | 'added' | 'removed'

export type DiffEntry = {
  key: string
  status: DiffStatus
  liveValue?: unknown
  persistedValue?: unknown
}

export const diffStates = (
  live: Record<string, unknown>,
  persisted: Record<string, unknown>
): DiffEntry[] => {
  const allKeys = new Set([...Object.keys(live), ...Object.keys(persisted)])
  const entries: DiffEntry[] = []

  for (const key of allKeys) {
    const inLive = key in live
    const inPersisted = key in persisted

    if (inLive && !inPersisted) {
      entries.push({ key, status: 'added', liveValue: live[key] })
    } else if (!inLive && inPersisted) {
      entries.push({ key, status: 'removed', persistedValue: persisted[key] })
    } else {
      const same = JSON.stringify(live[key]) === JSON.stringify(persisted[key])
      entries.push({
        key,
        status: same ? 'same' : 'changed',
        liveValue: live[key],
        persistedValue: persisted[key],
      })
    }
  }

  return entries.sort((a, b) => {
    const order: Record<DiffStatus, number> = { changed: 0, added: 1, removed: 2, same: 3 }
    return order[a.status] - order[b.status]
  })
}

// ── Migration info ──

export type SliceVersionInfo = {
  name: string
  persistedVersion: number
  currentVersion: number
  needsMigration: boolean
}

export const getSliceVersionInfo = (): SliceVersionInfo[] => {
  const persisted = getRawPersistedZustandState()
  const persistedVersions = (persisted?.[SLICE_VERSIONS_KEY] ?? {}) as Record<string, number>

  const featureCtx = require.context('@/stores/features', false, /\.ts$/)
  const featureKeys = featureCtx.keys().filter((k: string) => k !== './index.ts')

  return featureKeys.map((key: string) => {
    const mod = featureCtx(key) as { sliceConfig: { version?: number } }
    const name = key.replace(/^\.\//, '').replace(/\.ts$/, '')
    const currentVersion = mod.sliceConfig.version ?? 0
    const persistedVersion = persistedVersions[name] ?? 0
    return {
      name,
      persistedVersion,
      currentVersion,
      needsMigration: persistedVersion < currentVersion,
    }
  })
}

// ── Clear actions ──

export const clearPersistedZustandState = (): void => {
  storage.remove(ZUSTAND_KEY)
}

export const clearPersistedQueryState = (): void => {
  storage.remove(QUERY_KEY)
}

export const clearAllStorage = (): void => {
  storage.clearAll()
}

export const forceRehydrate = (): void => {
  void useAppStore.persist.rehydrate()
}
