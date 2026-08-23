import { useSyncExternalStore } from 'react'

import {
  addCleaningActivity,
  addDbActivity,
  clearActivityHistory,
  deleteActivityRecords,
  getActivitySnapshot,
  subscribeToActivity,
} from '@/storage/activityStorage'

export { appendMeterTimelinePoint } from './activityMath'
export {
  MAX_ACTIVITY_RECORDS_PER_CATEGORY,
  MAX_DB_TIMELINE_POINTS,
  MIN_DB_SESSION_DURATION_SECONDS,
  normalizeCleaningActivityRecord,
  normalizeDbActivityRecord,
  sanitizePersistedActivityState,
} from './activityValidation'
export type * from './types'

export {
  addCleaningActivity,
  addDbActivity,
  clearActivityHistory,
  deleteActivityRecords,
  getActivitySnapshot,
}

export const useActivityHistory = () =>
  useSyncExternalStore(subscribeToActivity, getActivitySnapshot, getActivitySnapshot)
