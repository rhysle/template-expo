import type { AudioResultState, AudioStopReason, MeterBand } from './types'

export const MIN_FREQUENCY_HZ = 20
export const MAX_FREQUENCY_HZ = 20_000
export const ESTIMATED_DB_REFERENCE = 100
export const MAX_ESTIMATED_DB = 120
export const METER_BAND_THRESHOLDS = {
  normal: 30,
  loud: 70,
  danger: 100,
} as const

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
