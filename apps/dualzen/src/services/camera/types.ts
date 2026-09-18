export type OutputKind = 'portrait' | 'landscape'
export type CaptureMode = 'single' | 'dual'
export type RecordingPhase = 'idle' | 'preparing' | 'recording' | 'finalizing' | 'exporting'
export interface RecordingSettings {
  longEdge: 1280 | 1920 | 2560 | 3840
  fps: 24 | 25 | 30 | 50 | 60 | 120
  container: 'mp4' | 'mov'
  hdr: boolean
  stabilization: boolean
  mode: CaptureMode
  front: boolean
  deviceId: string | null
  pairIndex: number
  portraitPosition: number
  landscapePosition: number
  grid: boolean
}
export const DEFAULT_SETTINGS: RecordingSettings = {
  longEdge: 1920,
  fps: 30,
  container: 'mp4',
  hdr: false,
  stabilization: true,
  mode: 'single',
  front: false,
  deviceId: null,
  pairIndex: 0,
  portraitPosition: 0.5,
  landscapePosition: 0.5,
  grid: false,
}
export interface PixelSize {
  width: number
  height: number
}
export interface VideoOutput extends PixelSize {
  kind: OutputKind
  filename: string
  bytes: number
  bitrate: number
  ready: boolean
  keyframes: number[]
  error?: string
}
export interface TrimRange {
  start: number
  end: number
}
export interface ExportResult {
  kind: OutputKind
  assetId?: string
  error?: string
}
export interface ExportReceipt {
  kind: OutputKind
  revision: string
  assetId: string
}
export interface Take {
  id: string
  projectId: string
  createdAt: number
  duration: number
  settings: RecordingSettings
  outputs: VideoOutput[]
  trim: TrimRange | null
  exports: ExportReceipt[]
  reason: string
  error?: string
}
export interface Project {
  id: string
  name: string | null
  createdAt: number
}
export const DEFAULT_PROJECT_ID = 'default'
export interface NativeRecordingResult {
  id: string
  duration: number
  outputs: VideoOutput[]
  reason: string
  error?: string
  frames: number
  dropped: number
}
export interface RecorderStats {
  thermal: number
  freeBytes: number
  frames: number
  dropped: number
  recording: boolean
  source0?: PixelSize & { fps?: number; rotation?: number }
  source1?: PixelSize & { fps?: number; rotation?: number }
  source2?: PixelSize & { fps?: number; rotation?: number }
}
export interface NativeCapabilities {
  hdr: boolean
  mov: boolean
}
export const FPS_OPTIONS = [24, 25, 30, 50, 60, 120] as const
export const RESOLUTION_OPTIONS = [1280, 1920, 2560, 3840] as const
export const RESOLUTION_LABELS = { 1280: '720p', 1920: '1080p', 2560: '2K', 3840: '4K' } as const
export function outputSize(source: PixelSize, kind: OutputKind, edge: number): PixelSize {
  const portrait = kind === 'portrait'
  const ratio = portrait ? 9 / 16 : 16 / 9
  const width = Math.min(source.width, source.height * ratio)
  const height = Math.min(source.height, source.width / ratio)
  const scale = Math.min(1, edge / Math.max(width, height))
  const unit = Math.floor(
    Math.min((width * scale) / (portrait ? 18 : 32), (height * scale) / (portrait ? 32 : 18))
  )
  return { width: unit * (portrait ? 18 : 32), height: unit * (portrait ? 32 : 18) }
}
export function sharedCutPoints(take: Take): number[] {
  const ready = take.outputs.filter((output) => output.ready)
  if (!ready.length) return []
  const tolerance = 0.25 / take.settings.fps
  const shared = ready[0].keyframes.filter((point) =>
    ready.every((output) => output.keyframes.some((other) => Math.abs(point - other) <= tolerance))
  )
  return [
    ...new Set([0, ...shared.filter((point) => point > 0 && point < take.duration), take.duration]),
  ].sort((a, b) => a - b)
}
export function snapTrim(take: Take, start: number, end: number): TrimRange | null {
  const points = sharedCutPoints(take)
  if (points.length < 2) return null
  const nearest = (value: number) =>
    points.reduce(
      (best, point) => (Math.abs(point - value) < Math.abs(best - value) ? point : best),
      points[0]
    )
  const range = { start: nearest(start), end: nearest(end) }
  return range.end > range.start ? range : null
}
export const formatDuration = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
}
