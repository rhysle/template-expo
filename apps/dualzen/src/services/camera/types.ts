export type OutputKind = 'portrait' | 'landscape'
export type CaptureMode = 'single' | 'dual'
export type CapturePhase =
  'idle' | 'switching' | 'preparing' | 'recording' | 'capturing' | 'finalizing' | 'exporting'
export type MediaType = 'video' | 'photo'
export type SessionStrategy = 'combined' | 'mode-specific'
export type PreviewLayout = 'pip' | 'stacked' | 'guide'
export interface PipViewSettings {
  /** Normalized left-to-right position within the available preview area. */
  x: number
  /** Normalized top-to-bottom position within the available preview area. */
  y: number
  /** Width of the PiP preview as a fraction of the portrait preview width. */
  size: number
}
export interface CameraViewSettings {
  layout: PreviewLayout
  pip: PipViewSettings
}
export const DEFAULT_CAMERA_VIEW_SETTINGS: CameraViewSettings = {
  layout: 'pip',
  pip: { x: 1, y: 1, size: 0.4 },
}
export interface SharedCaptureSettings {
  longEdge: 1280 | 1920 | 2560 | 3840
  mode: CaptureMode
  front: boolean
  deviceId: string | null
  pairIndex: number
  portraitPosition: number
  landscapePosition: number
  grid: boolean
}
export interface VideoSettings {
  fps: 24 | 25 | 30 | 50 | 60 | 120
  container: 'mp4' | 'mov'
  hdr: boolean
  stabilization: boolean
}
export type RecordingSettings = SharedCaptureSettings & VideoSettings
export interface LiveCameraSettings {
  zoom: number
  focus: { x: number; y: number; kind: OutputKind; locked: boolean } | null
  exposure: Record<OutputKind, number>
}
export const DEFAULT_SHARED_CAPTURE_SETTINGS: SharedCaptureSettings = {
  longEdge: 1920,
  mode: 'single',
  front: false,
  deviceId: null,
  pairIndex: 0,
  portraitPosition: 0.5,
  landscapePosition: 0.5,
  grid: false,
}
export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  fps: 30,
  container: 'mp4',
  hdr: false,
  stabilization: true,
}
export const DEFAULT_LIVE_CAMERA_SETTINGS: LiveCameraSettings = {
  zoom: 1,
  focus: null,
  exposure: { portrait: 0, landscape: 0 },
}
export const DEFAULT_SETTINGS: RecordingSettings = {
  ...DEFAULT_SHARED_CAPTURE_SETTINGS,
  ...DEFAULT_VIDEO_SETTINGS,
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
export interface PhotoOutput extends PixelSize {
  kind: OutputKind
  filename: string
  bytes: number
  ready: boolean
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
interface ProjectMediaBase {
  id: string
  projectId: string
  createdAt: number
  mediaType: MediaType
  exports: ExportReceipt[]
  error?: string
}
export interface VideoCapture extends ProjectMediaBase {
  mediaType: 'video'
  duration: number
  settings: RecordingSettings
  outputs: VideoOutput[]
  trim: TrimRange | null
  reason: string
}
export interface PhotoSettings {
  mode: CaptureMode
  front: boolean
  deviceId: string | null
  pairIndex: number
  portraitPosition: number
  landscapePosition: number
  longEdge: SharedCaptureSettings['longEdge']
  container: 'jpeg'
  quality: number
  targetResolution: PixelSize
  hdr: boolean
  flashMode: 'off' | 'on'
}
export interface PhotoCapture extends ProjectMediaBase {
  mediaType: 'photo'
  settings: PhotoSettings
  outputs: PhotoOutput[]
}
export type ProjectMedia = VideoCapture | PhotoCapture
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
export function cropSize(source: PixelSize, kind: OutputKind): PixelSize {
  const portrait = kind === 'portrait'
  const ratio = portrait ? 9 / 16 : 16 / 9
  return {
    width: Math.floor(Math.min(source.width, source.height * ratio)),
    height: Math.floor(Math.min(source.height, source.width / ratio)),
  }
}
export function outputSize(source: PixelSize, kind: OutputKind, edge: number): PixelSize {
  const portrait = kind === 'portrait'
  const { width, height } = cropSize(source, kind)
  const scale = Math.min(1, edge / Math.max(width, height))
  const unit = Math.floor(
    Math.min((width * scale) / (portrait ? 18 : 32), (height * scale) / (portrait ? 32 : 18))
  )
  return { width: unit * (portrait ? 18 : 32), height: unit * (portrait ? 32 : 18) }
}
export function sharedCutPoints(take: VideoCapture): number[] {
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
export function snapTrim(take: VideoCapture, start: number, end: number): TrimRange | null {
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
