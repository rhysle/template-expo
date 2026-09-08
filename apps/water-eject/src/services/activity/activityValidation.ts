import type { AudioStopReason } from '@/services/audio/types'

import type { CleaningActivityRecord, DbActivityRecord, DbTimelinePoint } from './types'

export const MAX_ACTIVITY_RECORDS_PER_CATEGORY = 100
export const MAX_DB_TIMELINE_POINTS = 3_600
export const MIN_DB_SESSION_DURATION_SECONDS = 1

export interface PersistedActivityState {
  cleaning: CleaningActivityRecord[]
  db: DbActivityRecord[]
}

const STOP_REASONS = [
  'completed',
  'manual',
  'blur',
  'background',
  'interruption',
  'route-change',
  'replaced',
  'error',
] as const satisfies readonly AudioStopReason[]
const ROUTINE_IDS = ['balanced', 'turbo'] as const

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isOneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'string' && options.includes(value as T)

export const normalizeCleaningActivityRecord = (value: unknown): CleaningActivityRecord | null => {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<CleaningActivityRecord>
  if (
    typeof record.id !== 'string' ||
    record.id.length === 0 ||
    !isFiniteNumber(record.startedAtMs) ||
    record.startedAtMs < 0 ||
    !isFiniteNumber(record.configuredDurationSeconds) ||
    record.configuredDurationSeconds <= 0 ||
    !isFiniteNumber(record.actualDurationSeconds) ||
    record.actualDurationSeconds < 0 ||
    !isOneOf(record.routineId, ROUTINE_IDS) ||
    !isOneOf(record.stopReason, STOP_REASONS) ||
    !isFiniteNumber(record.endedAtMs) ||
    record.endedAtMs < record.startedAtMs
  ) {
    return null
  }

  return {
    id: record.id,
    startedAtMs: record.startedAtMs,
    endedAtMs: record.endedAtMs,
    configuredDurationSeconds: record.configuredDurationSeconds,
    actualDurationSeconds: record.actualDurationSeconds,
    routineId: record.routineId,
    stopReason: record.stopReason,
  }
}

const normalizeTimeline = (value: unknown): DbTimelinePoint[] | null => {
  if (!Array.isArray(value)) return null
  let previousSecond = -1
  const timeline: DbTimelinePoint[] = []
  for (const point of value) {
    if (!point || typeof point !== 'object') return null
    const { second, estimatedDb } = point as Partial<DbTimelinePoint>
    if (
      !isFiniteNumber(second) ||
      !Number.isInteger(estimatedDb) ||
      (second ?? -1) <= previousSecond ||
      (second ?? -1) < 0 ||
      (estimatedDb ?? -1) < 0 ||
      (estimatedDb ?? 121) > 120
    ) {
      return null
    }
    previousSecond = second as number
    timeline.push({ second: second as number, estimatedDb: estimatedDb as number })
  }
  return timeline.slice(-MAX_DB_TIMELINE_POINTS)
}

export const normalizeDbActivityRecord = (value: unknown): DbActivityRecord | null => {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<DbActivityRecord>
  const timeline = normalizeTimeline(record.timeline)
  if (
    typeof record.id !== 'string' ||
    record.id.length === 0 ||
    !isFiniteNumber(record.startedAtMs) ||
    record.startedAtMs < 0 ||
    !isFiniteNumber(record.endedAtMs) ||
    record.endedAtMs < record.startedAtMs ||
    !isFiniteNumber(record.durationSeconds) ||
    record.durationSeconds < MIN_DB_SESSION_DURATION_SECONDS ||
    !isFiniteNumber(record.minimumDb) ||
    !isFiniteNumber(record.averageDb) ||
    !isFiniteNumber(record.maximumDb) ||
    record.minimumDb > record.averageDb ||
    record.averageDb > record.maximumDb ||
    !isOneOf(record.stopReason, STOP_REASONS) ||
    timeline === null
  ) {
    return null
  }

  return {
    id: record.id,
    startedAtMs: record.startedAtMs,
    endedAtMs: record.endedAtMs,
    durationSeconds: record.durationSeconds,
    minimumDb: record.minimumDb,
    averageDb: record.averageDb,
    maximumDb: record.maximumDb,
    stopReason: record.stopReason,
    timeline,
  }
}

export const emptyPersistedActivityState = (): PersistedActivityState => ({
  cleaning: [],
  db: [],
})

export const sanitizePersistedActivityState = (value: unknown): PersistedActivityState => {
  if (!value || typeof value !== 'object') return emptyPersistedActivityState()
  const state = value as Partial<PersistedActivityState>

  return {
    cleaning: (Array.isArray(state.cleaning) ? state.cleaning : [])
      .map(normalizeCleaningActivityRecord)
      .filter((record): record is CleaningActivityRecord => record !== null)
      .sort((left, right) => right.startedAtMs - left.startedAtMs)
      .slice(0, MAX_ACTIVITY_RECORDS_PER_CATEGORY),
    db: (Array.isArray(state.db) ? state.db : [])
      .map(normalizeDbActivityRecord)
      .filter((record): record is DbActivityRecord => record !== null)
      .sort((left, right) => right.startedAtMs - left.startedAtMs)
      .slice(0, MAX_ACTIVITY_RECORDS_PER_CATEGORY),
  }
}
