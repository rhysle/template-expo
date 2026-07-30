import type { AudioStopReason, EjectRoutineId } from '@/services/audio/types'

export type ActivityRecordKind = 'cleaning' | 'db'

export interface ActivityRecordReference {
  id: string
  kind: ActivityRecordKind
}

export interface CleaningActivityRecord {
  id: string
  startedAtMs: number
  endedAtMs: number
  configuredDurationSeconds: number
  actualDurationSeconds: number
  routineId: EjectRoutineId
  stopReason: AudioStopReason
}

export interface DbTimelinePoint {
  second: number
  estimatedDb: number
}

export interface DbActivityRecord {
  id: string
  startedAtMs: number
  endedAtMs: number
  durationSeconds: number
  minimumDb: number
  averageDb: number
  maximumDb: number
  stopReason: AudioStopReason
  timeline: DbTimelinePoint[]
}

export interface ActivityCounts {
  cleaning: number
  db: number
  total: number
}

export interface ActivitySnapshot {
  cleaning: CleaningActivityRecord[]
  db: DbActivityRecord[]
  counts: ActivityCounts
}
