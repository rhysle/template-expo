import { removeActivityRecordsFromState } from '@/services/activity/activityMutation'
import {
  emptyPersistedActivityState,
  MAX_ACTIVITY_RECORDS_PER_CATEGORY,
  normalizeCleaningActivityRecord,
  normalizeDbActivityRecord,
  type PersistedActivityState,
  sanitizePersistedActivityState,
} from '@/services/activity/activityValidation'
import type {
  ActivityRecordReference,
  ActivitySnapshot,
  CleaningActivityRecord,
  DbActivityRecord,
} from '@/services/activity/types'

import { storage } from './core/engine'
import { createNamespaceKey, registerStorageNamespace } from './core/keys'

const ACTIVITY_NAMESPACE = 'audioActivity'
registerStorageNamespace(ACTIVITY_NAMESPACE)
const key = createNamespaceKey(ACTIVITY_NAMESPACE)
const ACTIVITY_KEY = key('history')

const readState = (): PersistedActivityState => {
  try {
    const raw = storage.getString(ACTIVITY_KEY)
    return raw ? sanitizePersistedActivityState(JSON.parse(raw)) : emptyPersistedActivityState()
  } catch (error) {
    console.warn('Failed to read audio activity history:', error)
    return emptyPersistedActivityState()
  }
}

let persistedState = readState()
const listeners = new Set<() => void>()

const toSnapshot = (state: PersistedActivityState): ActivitySnapshot => ({
  cleaning: state.cleaning,
  db: state.db,
  counts: {
    cleaning: state.cleaning.length,
    db: state.db.length,
    total: state.cleaning.length + state.db.length,
  },
})

let snapshot = toSnapshot(persistedState)

const commit = (next: PersistedActivityState) => {
  persistedState = next
  snapshot = toSnapshot(next)
  try {
    storage.set(ACTIVITY_KEY, JSON.stringify(next))
  } catch (error) {
    console.warn('Failed to persist audio activity history:', error)
  }
  listeners.forEach((listener) => listener())
}

export const subscribeToActivity = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getActivitySnapshot = (): ActivitySnapshot => snapshot

export const addCleaningActivity = (record: CleaningActivityRecord): void => {
  const normalized = normalizeCleaningActivityRecord(record)
  if (!normalized) return
  commit({
    ...persistedState,
    cleaning: [normalized, ...persistedState.cleaning.filter(({ id }) => id !== record.id)]
      .sort((left, right) => right.startedAtMs - left.startedAtMs)
      .slice(0, MAX_ACTIVITY_RECORDS_PER_CATEGORY),
  })
}

export const addDbActivity = (record: DbActivityRecord): void => {
  const normalized = normalizeDbActivityRecord(record)
  if (!normalized) return
  commit({
    ...persistedState,
    db: [normalized, ...persistedState.db.filter(({ id }) => id !== record.id)]
      .sort((left, right) => right.startedAtMs - left.startedAtMs)
      .slice(0, MAX_ACTIVITY_RECORDS_PER_CATEGORY),
  })
}

export const deleteActivityRecords = (records: readonly ActivityRecordReference[]): void => {
  const next = removeActivityRecordsFromState(persistedState, records)
  if (next !== persistedState) commit(next)
}

export const clearActivityHistory = (): void => {
  commit(emptyPersistedActivityState())
}
