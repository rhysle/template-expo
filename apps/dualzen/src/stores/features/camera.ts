import type { SliceConfig } from '@shared/core/stores/slices/types'
import { useShallow } from 'zustand/react/shallow'

import {
  type CameraViewSettings,
  type CapturePhase,
  DEFAULT_CAMERA_VIEW_SETTINGS,
  DEFAULT_SETTINGS,
  type PhotoFlashMode,
  type PipViewSettings,
  type PreviewLayout,
  type RecordingSettings,
} from '@/services/camera/types'

import { getUseAppStore } from '../slices/types'

interface CameraSlice {
  settings: RecordingSettings
  viewSettings: CameraViewSettings
  photoFlashMode: PhotoFlashMode
  autoSaveToLibrary: boolean
  phase: CapturePhase
  updateSettings: (settings: Partial<RecordingSettings>) => void
  setPreviewLayout: (layout: PreviewLayout) => void
  updatePipView: (settings: Partial<PipViewSettings>) => void
  setPhotoFlashMode: (value: PhotoFlashMode) => void
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
    settings: DEFAULT_SETTINGS,
    viewSettings: DEFAULT_CAMERA_VIEW_SETTINGS,
    photoFlashMode: 'off',
    autoSaveToLibrary: false,
    phase: 'idle',
    updateSettings: (settings) =>
      set((state) => {
        state.settings = { ...state.settings, ...settings }
      }),
    setPreviewLayout: (layout) =>
      set((state) => {
        state.viewSettings.layout = layout
      }),
    updatePipView: (settings) =>
      set((state) => {
        state.viewSettings.pip = { ...state.viewSettings.pip, ...settings }
      }),
    setPhotoFlashMode: (value) =>
      set((state) => {
        state.photoFlashMode = value
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
  persistExcludeKeys: ['phase'],
} satisfies SliceConfig<CameraSlice>
export const useCameraState = () => getUseAppStore()(useShallow((state) => ({ ...state.camera })))
