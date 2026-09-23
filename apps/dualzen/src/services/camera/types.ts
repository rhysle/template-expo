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
  mirrorFrontCamera: boolean
}
export interface VideoSettings {
  fps: 24 | 30 | 60 | 120
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
  mirrorFrontCamera: false,
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
export interface PixelRect extends PixelSize {
  x: number
  y: number
}
export interface VideoOutput extends PixelSize {
  kind: OutputKind
  filename: string
  bytes: number
  bitrate: number
  ready: boolean
  error?: string
}
export interface PhotoOutput extends PixelSize {
  kind: OutputKind
  filename: string
  bytes: number
  ready: boolean
  error?: string
}
export interface ExportResult {
  kind: OutputKind
  error?: string
}
interface ProjectMediaBase {
  id: string
  projectId: string
  createdAt: number
  mediaType: MediaType
  error?: string
}
export interface VideoCapture extends ProjectMediaBase {
  mediaType: 'video'
  duration: number
  settings: RecordingSettings
  outputs: VideoOutput[]
  reason: string
}
export type PhotoSettings = SharedCaptureSettings & {
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
  writerStatuses?: number[]
  audioSampleCounts?: number[]
}
export interface NativePhotoResult {
  outputs: PhotoOutput[]
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
export const FPS_OPTIONS = [24, 30, 60, 120] as const
export const RESOLUTION_OPTIONS = [1280, 1920, 2560, 3840] as const
export const RESOLUTION_LABELS = {
  1280: '720p (1280 x 720)',
  1920: '1080p (1920 x 1080)',
  2560: '2K (2560 x 1440)',
  3840: '4K (3840 x 2160)',
} as const
export const RESOLUTION_SHORT_LABELS = {
  1280: '720p',
  1920: '1080p',
  2560: '2K',
  3840: '4K',
} as const
export function cropSize(source: PixelSize, kind: OutputKind): PixelSize {
  const { width, height } = cropRect(source, kind, 0.5)
  return { width, height }
}
export function cropRect(source: PixelSize, kind: OutputKind, position: number): PixelRect {
  const portrait = kind === 'portrait'
  const ratio = portrait ? 9 / 16 : 16 / 9
  const width = Math.floor(Math.min(source.width, source.height * ratio))
  const height = Math.floor(Math.min(source.height, source.width / ratio))
  const p = Math.max(0, Math.min(1, position))
  return {
    x: (source.width - width) * p,
    // Nitro Image uses top-left image coordinates. Native video crops use Core Image's
    // bottom-left coordinates and convert the vertical position in native code.
    y: (source.height - height) * p,
    width,
    height,
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
export const formatDuration = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
}

export const formatFilmingTime = (seconds: number) => {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60))
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
}
