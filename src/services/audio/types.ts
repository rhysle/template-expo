import type { PermissionStatus } from 'react-native-audio-api'

import type { MeterResponse } from '@/stores/features/audioPreferences'

export type AudioTool = 'eject' | 'tone' | 'stereo' | 'meter'
export type AudioRuntimeStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error'
export type AudioStopReason =
  | 'completed'
  | 'manual'
  | 'blur'
  | 'background'
  | 'interruption'
  | 'route-change'
  | 'replaced'
  | 'error'

export type AudioResultState = 'completed' | 'interrupted' | 'idle'
export type OutputRouteKind = 'device' | 'external' | 'unknown'
export type StereoMode = 'manual' | 'auto'
export type MeterBand = 'veryQuiet' | 'normal' | 'loud' | 'danger'

export interface MeterStats {
  currentDb: number
  minimumDb: number
  averageDb: number
  maximumDb: number
  sampleCount: number
  band: MeterBand
}

export interface AudioSnapshot {
  status: AudioRuntimeStatus
  activeTool: AudioTool | null
  lastTool: AudioTool | null
  stopReason: AudioStopReason | null
  errorMessage: string | null
  elapsedSeconds: number
  durationSeconds: number | null
  frequencyHz: number
  stereoPan: number
  stereoMode: StereoMode | null
  meter: MeterStats
  microphonePermission: PermissionStatus
  outputRouteKind: OutputRouteKind
  outputRouteName: string | null
}

export interface MeterStartOptions {
  calibrationOffsetDb: number
  response: MeterResponse
}

export interface MeterStartResult {
  permission: PermissionStatus
  started: boolean
}
