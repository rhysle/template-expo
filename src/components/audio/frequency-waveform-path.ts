import type { ToneWaveform } from '@/services/audio'

interface FrequencyWaveformPathWriter {
  moveTo: (x: number, y: number) => unknown
  lineTo: (x: number, y: number) => unknown
}

interface FrequencyWaveformPathOptions {
  waveform: ToneWaveform
  width: number
  centerY: number
  cycles: number
  phase: number
  amplitude: number
}

const TAU = Math.PI * 2

const getContinuousWaveformSample = (waveform: ToneWaveform, angle: number): number => {
  'worklet'

  if (waveform === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(angle))
  return Math.sin(angle)
}

const appendSquarePath = (
  path: FrequencyWaveformPathWriter,
  width: number,
  centerY: number,
  cycles: number,
  phase: number,
  amplitude: number
) => {
  'worklet'

  let sample = Math.sin(phase) >= 0 ? 1 : -1
  path.moveTo(0, centerY + sample * amplitude)

  const endPhase = phase + TAU * cycles
  let transitionIndex = Math.floor(phase / Math.PI) + 1
  let transitionPhase = transitionIndex * Math.PI

  while (transitionPhase < endPhase) {
    const x = ((transitionPhase - phase) / (TAU * cycles)) * width
    path.lineTo(x, centerY + sample * amplitude)
    sample *= -1
    path.lineTo(x, centerY + sample * amplitude)
    transitionIndex += 1
    transitionPhase = transitionIndex * Math.PI
  }

  path.lineTo(width, centerY + sample * amplitude)
}

const appendSawtoothPath = (
  path: FrequencyWaveformPathWriter,
  width: number,
  centerY: number,
  cycles: number,
  phase: number,
  amplitude: number
) => {
  'worklet'

  const startCycle = phase / TAU
  const endCycle = startCycle + cycles
  const startSample = 2 * (startCycle - Math.floor(startCycle + 0.5))
  path.moveTo(0, centerY + startSample * amplitude)

  let transitionCycle = Math.floor(startCycle + 0.5) + 0.5
  while (transitionCycle < endCycle) {
    const x = ((transitionCycle - startCycle) / cycles) * width
    path.lineTo(x, centerY + amplitude)
    path.lineTo(x, centerY - amplitude)
    transitionCycle += 1
  }

  const endSample = 2 * (endCycle - Math.floor(endCycle + 0.5))
  path.lineTo(width, centerY + endSample * amplitude)
}

export const appendFrequencyWaveformPath = (
  path: FrequencyWaveformPathWriter,
  { waveform, width, centerY, cycles, phase, amplitude }: FrequencyWaveformPathOptions
) => {
  'worklet'

  if (width <= 0 || cycles <= 0) return

  if (waveform === 'square') {
    appendSquarePath(path, width, centerY, cycles, phase, amplitude)
    return
  }

  if (waveform === 'sawtooth') {
    appendSawtoothPath(path, width, centerY, cycles, phase, amplitude)
    return
  }

  const points = Math.max(Math.round(width / 3), 64)
  for (let index = 0; index <= points; index += 1) {
    const progress = index / points
    const x = progress * width
    const angle = progress * TAU * cycles + phase
    const sample = getContinuousWaveformSample(waveform, angle)
    const y = centerY + sample * amplitude
    if (index === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
}
