import type {
  AudioResultState,
  AudioStopReason,
  EjectPhase,
  EjectRoutineId,
  MeterBand,
} from './types'

export const MIN_FREQUENCY_HZ = 20
export const MAX_FREQUENCY_HZ = 20_000
export const ESTIMATED_DB_REFERENCE = 100
export const MAX_ESTIMATED_DB = 120
export const METER_BAND_THRESHOLDS = {
  normal: 30,
  loud: 70,
  danger: 100,
} as const
export const EJECT_WAVEFORM_TYPE = 'sine' as const
export const EJECT_ROUTINES = {
  balanced: { water: 3, debris: 2.5, finish: 2 },
  turbo: { water: 4, debris: 2, finish: 1.5 },
} as const satisfies Record<EjectRoutineId, Record<EjectPhase, number>>

interface EjectAudioProfile {
  water: {
    startHz: number
    peakHz: number
    endHz: number
    peakAt: number
    gainScale: number
  }
  debris: {
    lowHz: number
    highHz: number
    pulseSeconds: number
    gainScale: number
  }
  finish: { startHz: number; peakHz: number; endHz: number; gainScale: number }
  harmonic?: {
    ratio: number
    waterGainScale: number
    debrisGainScale: number
    finishGainScale: number
  }
}

export interface EjectTurboStep {
  durationWeight: number
  phase: EjectPhase
  startHz: number
  peakHz: number
  endHz: number
  peakAt: number
  gainScale: number
  harmonicRatio: number
  harmonicGainScale: number
}

// The reference progression uses one-way stages across the whole run rather than a short loop.
// Keep the weights at a total of 1 so every supported session length plays each stage exactly once.
export const EJECT_TURBO_STEPS = [
  {
    durationWeight: 0.2,
    phase: 'water',
    startHz: 145,
    peakHz: 165,
    endHz: 152,
    peakAt: 0.62,
    gainScale: 1,
    harmonicRatio: 4,
    harmonicGainScale: 0.1,
  },
  {
    durationWeight: 0.2,
    phase: 'water',
    startHz: 158,
    peakHz: 820,
    endHz: 690,
    peakAt: 0.84,
    gainScale: 0.88,
    harmonicRatio: 2,
    harmonicGainScale: 0.12,
  },
  {
    durationWeight: 0.2,
    phase: 'debris',
    startHz: 168,
    peakHz: 218,
    endHz: 186,
    peakAt: 0.58,
    gainScale: 0.98,
    harmonicRatio: 5,
    harmonicGainScale: 0.13,
  },
  {
    durationWeight: 0.2,
    phase: 'debris',
    startHz: 205,
    peakHz: 780,
    endHz: 640,
    peakAt: 0.8,
    gainScale: 0.84,
    harmonicRatio: 2.5,
    harmonicGainScale: 0.14,
  },
  {
    durationWeight: 0.2,
    phase: 'finish',
    startHz: 260,
    peakHz: 610,
    endHz: 175,
    peakAt: 0.38,
    gainScale: 0.66,
    harmonicRatio: 4,
    harmonicGainScale: 0.12,
  },
] as const satisfies readonly EjectTurboStep[]

export const EJECT_AUDIO_PROFILES: Record<EjectRoutineId, EjectAudioProfile> = {
  balanced: {
    water: { startHz: 155, peakHz: 230, endHz: 165, peakAt: 0.58, gainScale: 1 },
    debris: { lowHz: 280, highHz: 280, pulseSeconds: 0.7, gainScale: 0.62 },
    finish: { startHz: 190, peakHz: 560, endHz: 240, gainScale: 0.46 },
  },
  turbo: {
    water: { startHz: 200, peakHz: 380, endHz: 220, peakAt: 0.58, gainScale: 0.95 },
    debris: { lowHz: 240, highHz: 380, pulseSeconds: 0.5, gainScale: 0.8 },
    finish: { startHz: 220, peakHz: 400, endHz: 260, gainScale: 0.68 },
    harmonic: {
      ratio: 4,
      waterGainScale: 0.22,
      debrisGainScale: 0.18,
      finishGainScale: 0.16,
    },
  },
}
export const EJECT_PHASE_DURATION_SECONDS = EJECT_ROUTINES.balanced
export const EJECT_CYCLE_DURATION_SECONDS = 7.5
// react-native-audio-api caps each AudioParam queue at 64 events. The balanced window uses at
// most 24 gain events, while the complete five-stage turbo run uses 20.
const EJECT_INITIAL_SCHEDULE_CYCLES = 2

export interface EjectScheduleWindow {
  scheduleAtSeconds: number
  startSeconds: number
  endSeconds: number
}

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum)

export const normalizeFrequency = (frequencyHz: number): number => {
  const frequency = clamp(frequencyHz, MIN_FREQUENCY_HZ, MAX_FREQUENCY_HZ)
  return Math.log(frequency / MIN_FREQUENCY_HZ) / Math.log(MAX_FREQUENCY_HZ / MIN_FREQUENCY_HZ)
}

export const frequencyFromNormalized = (normalized: number): number => {
  const position = clamp(normalized, 0, 1)
  return Math.round(MIN_FREQUENCY_HZ * Math.pow(MAX_FREQUENCY_HZ / MIN_FREQUENCY_HZ, position))
}

export type FrequencyBand = 'veryLow' | 'low' | 'midLow' | 'mid' | 'high' | 'veryHigh'

export const getFrequencyBand = (frequencyHz: number): FrequencyBand => {
  if (frequencyHz < 60) return 'veryLow'
  if (frequencyHz < 250) return 'low'
  if (frequencyHz < 1_000) return 'midLow'
  if (frequencyHz < 2_500) return 'mid'
  if (frequencyHz < 6_000) return 'high'
  return 'veryHigh'
}

export const calculateRms = (samples: ArrayLike<number>): number => {
  if (samples.length === 0) return 0

  let sumOfSquares = 0
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Number(samples[index]) || 0
    sumOfSquares += sample * sample
  }

  return Math.sqrt(sumOfSquares / samples.length)
}

export const rmsToDbfs = (rms: number): number => {
  if (!Number.isFinite(rms) || rms <= 0) return -160
  return 20 * Math.log10(rms)
}

export const dbfsToEstimatedDb = (dbfs: number): number =>
  clamp(dbfs + ESTIMATED_DB_REFERENCE, 0, MAX_ESTIMATED_DB)

export const smoothMeterValue = (previousValue: number | null, nextValue: number): number => {
  if (previousValue === null || !Number.isFinite(previousValue)) return nextValue
  return previousValue + 0.35 * (nextValue - previousValue)
}

export const classifyMeterBand = (estimatedDb: number): MeterBand => {
  if (estimatedDb < METER_BAND_THRESHOLDS.normal) return 'veryQuiet'
  if (estimatedDb < METER_BAND_THRESHOLDS.loud) return 'normal'
  if (estimatedDb < METER_BAND_THRESHOLDS.danger) return 'loud'
  return 'danger'
}

export const calculateProgress = (elapsedSeconds: number, durationSeconds: number): number => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  return clamp(elapsedSeconds / durationSeconds, 0, 1)
}

export const getAudioResultState = (reason: AudioStopReason | null): AudioResultState => {
  if (reason === 'completed') return 'completed'
  if (reason && reason !== 'manual' && reason !== 'replaced') return 'interrupted'
  return 'idle'
}

export const getEjectPhase = (
  elapsedSeconds: number,
  routineId: EjectRoutineId = 'balanced',
  durationSeconds?: number
): EjectPhase => {
  const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(elapsedSeconds, 0) : 0

  if (routineId === 'turbo' && Number.isFinite(durationSeconds) && Number(durationSeconds) > 0) {
    const progress = clamp(safeElapsed / Number(durationSeconds), 0, 1)
    let stageEnd = 0

    for (const step of EJECT_TURBO_STEPS) {
      stageEnd += step.durationWeight
      if (progress < stageEnd) return step.phase
    }

    return 'finish'
  }

  const durations = EJECT_ROUTINES[routineId]
  const cycleDuration = durations.water + durations.debris + durations.finish
  const cycleElapsed = safeElapsed % cycleDuration

  if (cycleElapsed < durations.water) return 'water'
  if (cycleElapsed < durations.water + durations.debris) {
    return 'debris'
  }
  return 'finish'
}

export const getEjectScheduleWindows = (
  durationSeconds: number,
  routineId: EjectRoutineId = 'balanced'
): EjectScheduleWindow[] => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return []
  const durations = EJECT_ROUTINES[routineId]
  const cycleDuration = durations.water + durations.debris + durations.finish

  const initialEnd = Math.min(durationSeconds, cycleDuration * EJECT_INITIAL_SCHEDULE_CYCLES)
  const windows: EjectScheduleWindow[] = [
    {
      scheduleAtSeconds: 0,
      startSeconds: 0,
      endSeconds: initialEnd,
    },
  ]

  for (
    let startSeconds = initialEnd;
    startSeconds < durationSeconds;
    startSeconds += cycleDuration
  ) {
    windows.push({
      scheduleAtSeconds: startSeconds - cycleDuration,
      startSeconds,
      endSeconds: Math.min(startSeconds + cycleDuration, durationSeconds),
    })
  }

  return windows
}
