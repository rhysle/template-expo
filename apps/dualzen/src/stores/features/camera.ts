import type { SliceConfig } from '@shared/core/stores/slices/types'
import { useShallow } from 'zustand/react/shallow'

import {
  type CapturePhase,
  DEFAULT_SETTINGS,
  type PhotoFlashMode,
  type RecordingSettings,
} from '@/services/camera/types'

import { getUseAppStore } from '../slices/types'

interface CameraSlice {
  settings: RecordingSettings
  photoFlashMode: PhotoFlashMode
  autoSaveToLibrary: boolean
  phase: CapturePhase
  updateSettings: (settings: Partial<RecordingSettings>) => void
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
    photoFlashMode: 'off',
    autoSaveToLibrary: false,
    phase: 'idle',
    updateSettings: (settings) =>
      set((state) => {
        state.settings = { ...state.settings, ...settings }
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
