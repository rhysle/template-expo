import { useShallow } from 'zustand/react/shallow'

import type { ToneWaveform } from '@/services/audio'

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
  lastToneWaveform: ToneWaveform
  setEjectDurationSeconds: (duration: EjectDurationSeconds) => void
  setHapticsEnabled: (enabled: boolean) => void
  setLastToneFrequencyHz: (frequencyHz: number) => void
  setLastToneWaveform: (waveform: ToneWaveform) => void
}

const DEFAULT_FREQUENCY_HZ = 440
const DEFAULT_TONE_WAVEFORM: ToneWaveform = 'sine'

export const audioPreferencesPersistExcludeKeys: ExcludeKeys<AudioPreferencesSlice> = []

export const createAudioPreferencesSlice = (
  set: (updater: (state: AudioPreferencesSlice) => void) => void
): AudioPreferencesSlice => ({
  ejectDurationSeconds: 30,
  hapticsEnabled: true,
  lastToneFrequencyHz: DEFAULT_FREQUENCY_HZ,
  lastToneWaveform: DEFAULT_TONE_WAVEFORM,
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
  setLastToneWaveform: (waveform) =>
    set((state) => {
      state.lastToneWaveform = waveform
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
      lastToneWaveform: audioPreferences.lastToneWaveform,
      setEjectDurationSeconds: audioPreferences.setEjectDurationSeconds,
      setHapticsEnabled: audioPreferences.setHapticsEnabled,
      setLastToneFrequencyHz: audioPreferences.setLastToneFrequencyHz,
      setLastToneWaveform: audioPreferences.setLastToneWaveform,
    }))
  )
