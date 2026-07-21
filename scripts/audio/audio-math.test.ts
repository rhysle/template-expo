import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateProgress,
  calculateRms,
  classifyMeterBand,
  dbfsToEstimatedDb,
  frequencyFromNormalized,
  getAudioResultState,
  getFrequencyBand,
  normalizeFrequency,
  rmsToDbfs,
  smoothMeterValue,
} from '../../src/services/audio/audioMath.ts'

test('logarithmic frequency mapping preserves endpoints and round-trips', () => {
  assert.equal(frequencyFromNormalized(0), 20)
  assert.equal(frequencyFromNormalized(1), 20_000)
  assert.ok(Math.abs(frequencyFromNormalized(normalizeFrequency(440)) - 440) <= 1)
  assert.equal(frequencyFromNormalized(-1), 20)
  assert.equal(frequencyFromNormalized(2), 20_000)
})

test('frequency bands use stable boundaries', () => {
  assert.equal(getFrequencyBand(59), 'veryLow')
  assert.equal(getFrequencyBand(60), 'low')
  assert.equal(getFrequencyBand(250), 'midLow')
  assert.equal(getFrequencyBand(1_000), 'mid')
  assert.equal(getFrequencyBand(2_500), 'high')
  assert.equal(getFrequencyBand(6_000), 'veryHigh')
})

test('RMS, dBFS, calibration, and clamping are deterministic', () => {
  assert.equal(calculateRms([]), 0)
  assert.ok(Math.abs(calculateRms([1, -1, 1, -1]) - 1) < 0.000_001)
  assert.ok(Math.abs(rmsToDbfs(0.5) + 6.0206) < 0.001)
  assert.equal(rmsToDbfs(0), -160)
  assert.equal(dbfsToEstimatedDb(-50), 50)
  assert.equal(dbfsToEstimatedDb(-50, 10), 60)
  assert.equal(dbfsToEstimatedDb(50), 120)
  assert.equal(dbfsToEstimatedDb(-200), 0)
})

test('meter smoothing and classifications follow product thresholds', () => {
  assert.equal(smoothMeterValue(null, 80, 'fast'), 80)
  assert.equal(smoothMeterValue(40, 80, 'fast'), 54)
  assert.equal(smoothMeterValue(40, 80, 'slow'), 44)
  assert.equal(classifyMeterBand(29.9), 'veryQuiet')
  assert.equal(classifyMeterBand(30), 'normal')
  assert.equal(classifyMeterBand(70), 'loud')
  assert.equal(classifyMeterBand(100), 'danger')
})

test('progress and stop reasons map to observable result states', () => {
  assert.equal(calculateProgress(15, 30), 0.5)
  assert.equal(calculateProgress(40, 30), 1)
  assert.equal(calculateProgress(10, 0), 0)
  assert.equal(getAudioResultState('completed'), 'completed')
  assert.equal(getAudioResultState('background'), 'interrupted')
  assert.equal(getAudioResultState('manual'), 'idle')
  assert.equal(getAudioResultState('replaced'), 'idle')
  assert.equal(getAudioResultState(null), 'idle')
})
