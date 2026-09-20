import type { SliceConfig } from '@shared/core/stores/slices/types'
import { useShallow } from 'zustand/react/shallow'

import {
  type CameraViewSettings,
  type CapturePhase,
  DEFAULT_CAMERA_VIEW_SETTINGS,
  DEFAULT_LIVE_CAMERA_SETTINGS,
  DEFAULT_SHARED_CAPTURE_SETTINGS,
  DEFAULT_VIDEO_SETTINGS,
  type LiveCameraSettings,
  type MediaType,
  type PipViewSettings,
  type PreviewLayout,
  type SessionStrategy,
  type SharedCaptureSettings,
  type VideoSettings,
} from '@/services/camera/types'

import { getUseAppStore } from '../slices/types'

interface CameraSlice {
  sharedSettings: SharedCaptureSettings
  videoSettings: VideoSettings
  viewSettings: CameraViewSettings
  mediaType: MediaType
  lightEnabled: boolean
  liveSettings: LiveCameraSettings
  sessionStrategy: SessionStrategy
  autoSaveToLibrary: boolean
  phase: CapturePhase
  updateSharedSettings: (settings: Partial<SharedCaptureSettings>) => void
  updateVideoSettings: (settings: Partial<VideoSettings>) => void
  setPreviewLayout: (layout: PreviewLayout) => void
  updatePipView: (settings: Partial<PipViewSettings>) => void
  setMediaType: (value: MediaType) => void
  setLightEnabled: (value: boolean) => void
  updateLiveSettings: (settings: Partial<LiveCameraSettings>) => void
  setSessionStrategy: (value: SessionStrategy) => void
  setAutoSaveToLibrary: (value: boolean) => void
  setPhase: (phase: CapturePhase) => void
}
declare global {
  interface AppSlices {
    camera: CameraSlice
  }
}
export const sliceConfig = {
  create: (set: (updater: (state: CameraSlice) => void) => void): CameraSlice => ({
    sharedSettings: DEFAULT_SHARED_CAPTURE_SETTINGS,
    videoSettings: DEFAULT_VIDEO_SETTINGS,
    viewSettings: DEFAULT_CAMERA_VIEW_SETTINGS,
    mediaType: 'video',
    lightEnabled: false,
    liveSettings: DEFAULT_LIVE_CAMERA_SETTINGS,
    sessionStrategy: 'combined',
    autoSaveToLibrary: false,
    phase: 'idle',
    updateSharedSettings: (settings) =>
      set((state) => {
        state.sharedSettings = { ...state.sharedSettings, ...settings }
        if (['longEdge', 'mode', 'front', 'deviceId', 'pairIndex'].some((key) => key in settings))
          state.sessionStrategy = 'combined'
      }),
    updateVideoSettings: (settings) =>
      set((state) => {
        state.videoSettings = { ...state.videoSettings, ...settings }
        if (['fps', 'hdr', 'stabilization'].some((key) => key in settings))
          state.sessionStrategy = 'combined'
      }),
    setPreviewLayout: (layout) =>
      set((state) => {
        state.viewSettings.layout = layout
      }),
    updatePipView: (settings) =>
      set((state) => {
        state.viewSettings.pip = { ...state.viewSettings.pip, ...settings }
      }),
    setMediaType: (value) =>
      set((state) => {
        state.mediaType = value
      }),
    setLightEnabled: (value) =>
      set((state) => {
        state.lightEnabled = value
      }),
    updateLiveSettings: (settings) =>
      set((state) => {
        state.liveSettings = { ...state.liveSettings, ...settings }
      }),
    setSessionStrategy: (value) =>
      set((state) => {
        state.sessionStrategy = value
      }),
    setAutoSaveToLibrary: (value) =>
      set((state) => {
        state.autoSaveToLibrary = value
      }),
    setPhase: (phase) =>
      set((state) => {
        state.phase = phase
      }),
  }),
  persistExcludeKeys: ['mediaType', 'lightEnabled', 'liveSettings', 'sessionStrategy', 'phase'],
} satisfies SliceConfig<CameraSlice>
export const useCameraState = () => getUseAppStore()(useShallow((state) => ({ ...state.camera })))
