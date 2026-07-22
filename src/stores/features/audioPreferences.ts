import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

export type EjectDurationSeconds = 30 | 60 | 90

declare global {
  interface AppSlices {
    audioPreferences: AudioPreferencesSlice
  }
}

export interface AudioPreferencesSlice {
  ejectDurationSeconds: EjectDurationSeconds
  hapticsEnabled: boolean
  lastToneFrequencyHz: number
  setEjectDurationSeconds: (duration: EjectDurationSeconds) => void
  setHapticsEnabled: (enabled: boolean) => void
  setLastToneFrequencyHz: (frequencyHz: number) => void
}

const DEFAULT_FREQUENCY_HZ = 440

export const audioPreferencesPersistExcludeKeys: ExcludeKeys<AudioPreferencesSlice> = []

export const createAudioPreferencesSlice = (
  set: (updater: (state: AudioPreferencesSlice) => void) => void
): AudioPreferencesSlice => ({
  ejectDurationSeconds: 30,
  hapticsEnabled: true,
  lastToneFrequencyHz: DEFAULT_FREQUENCY_HZ,
  setEjectDurationSeconds: (duration) =>
    set((state) => {
      state.ejectDurationSeconds = duration
    }),
  setHapticsEnabled: (enabled) =>
    set((state) => {
      state.hapticsEnabled = enabled
    }),
  setLastToneFrequencyHz: (frequencyHz) =>
    set((state) => {
      state.lastToneFrequencyHz = Math.min(Math.max(Math.round(frequencyHz), 20), 20_000)
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
      lastToneFrequencyHz: audioPreferences.lastToneFrequencyHz,
      setEjectDurationSeconds: audioPreferences.setEjectDurationSeconds,
      setHapticsEnabled: audioPreferences.setHapticsEnabled,
      setLastToneFrequencyHz: audioPreferences.setLastToneFrequencyHz,
    }))
  )
