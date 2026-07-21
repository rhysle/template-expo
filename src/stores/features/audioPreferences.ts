import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

export type EjectDurationSeconds = 30 | 60 | 90
export type MeterResponse = 'fast' | 'slow'

declare global {
  interface AppSlices {
    audioPreferences: AudioPreferencesSlice
  }
}

export interface AudioPreferencesSlice {
  ejectDurationSeconds: EjectDurationSeconds
  hapticsEnabled: boolean
  meterResponse: MeterResponse
  meterCalibrationOffsetDb: number
  lastToneFrequencyHz: number
  setEjectDurationSeconds: (duration: EjectDurationSeconds) => void
  setHapticsEnabled: (enabled: boolean) => void
  setMeterResponse: (response: MeterResponse) => void
  setMeterCalibrationOffsetDb: (offsetDb: number) => void
  setLastToneFrequencyHz: (frequencyHz: number) => void
  resetMeterCalibration: () => void
}

const DEFAULT_FREQUENCY_HZ = 440
const MIN_CALIBRATION_DB = -20
const MAX_CALIBRATION_DB = 20

export const audioPreferencesPersistExcludeKeys: ExcludeKeys<AudioPreferencesSlice> = []

export const createAudioPreferencesSlice = (
  set: (updater: (state: AudioPreferencesSlice) => void) => void
): AudioPreferencesSlice => ({
  ejectDurationSeconds: 30,
  hapticsEnabled: true,
  meterResponse: 'fast',
  meterCalibrationOffsetDb: 0,
  lastToneFrequencyHz: DEFAULT_FREQUENCY_HZ,
  setEjectDurationSeconds: (duration) =>
    set((state) => {
      state.ejectDurationSeconds = duration
    }),
  setHapticsEnabled: (enabled) =>
    set((state) => {
      state.hapticsEnabled = enabled
    }),
  setMeterResponse: (response) =>
    set((state) => {
      state.meterResponse = response
    }),
  setMeterCalibrationOffsetDb: (offsetDb) =>
    set((state) => {
      state.meterCalibrationOffsetDb = Math.min(
        Math.max(Math.round(offsetDb), MIN_CALIBRATION_DB),
        MAX_CALIBRATION_DB
      )
    }),
  setLastToneFrequencyHz: (frequencyHz) =>
    set((state) => {
      state.lastToneFrequencyHz = Math.min(Math.max(Math.round(frequencyHz), 20), 20_000)
    }),
  resetMeterCalibration: () =>
    set((state) => {
      state.meterCalibrationOffsetDb = 0
    }),
})

export const sliceConfig = {
  create: createAudioPreferencesSlice,
  persistExcludeKeys: audioPreferencesPersistExcludeKeys,
} satisfies SliceConfig<AudioPreferencesSlice>

export const useAudioPreferencesState = () =>
  getUseAppStore()(
    useShallow(({ audioPreferences }) => ({
      ejectDurationSeconds: audioPreferences.ejectDurationSeconds,
      hapticsEnabled: audioPreferences.hapticsEnabled,
      meterResponse: audioPreferences.meterResponse,
      meterCalibrationOffsetDb: audioPreferences.meterCalibrationOffsetDb,
      lastToneFrequencyHz: audioPreferences.lastToneFrequencyHz,
      setEjectDurationSeconds: audioPreferences.setEjectDurationSeconds,
      setHapticsEnabled: audioPreferences.setHapticsEnabled,
      setMeterResponse: audioPreferences.setMeterResponse,
      setMeterCalibrationOffsetDb: audioPreferences.setMeterCalibrationOffsetDb,
      setLastToneFrequencyHz: audioPreferences.setLastToneFrequencyHz,
      resetMeterCalibration: audioPreferences.resetMeterCalibration,
    }))
  )
