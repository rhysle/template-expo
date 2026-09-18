import type { SliceConfig } from '@shared/core/stores/slices/types'
import { useShallow } from 'zustand/react/shallow'

import {
  DEFAULT_SETTINGS,
  type RecordingPhase,
  type RecordingSettings,
} from '@/services/camera/types'

import { getUseAppStore } from '../slices/types'

interface CameraSlice {
  settings: RecordingSettings
  autoExport: boolean
  phase: RecordingPhase
  updateSettings: (settings: Partial<RecordingSettings>) => void
  setAutoExport: (value: boolean) => void
  setPhase: (phase: RecordingPhase) => void
}
declare global {
  interface AppSlices {
    camera: CameraSlice
  }
}
export const sliceConfig = {
  create: (set: (updater: (state: CameraSlice) => void) => void): CameraSlice => ({
    settings: DEFAULT_SETTINGS,
    autoExport: false,
    phase: 'idle',
    updateSettings: (settings) =>
      set((state) => {
        state.settings = { ...state.settings, ...settings }
      }),
    setAutoExport: (value) =>
      set((state) => {
        state.autoExport = value
      }),
    setPhase: (phase) =>
      set((state) => {
        state.phase = phase
      }),
  }),
  persistExcludeKeys: ['phase'],
} satisfies SliceConfig<CameraSlice>
export const useCameraState = () => getUseAppStore()(useShallow((state) => ({ ...state.camera })))
