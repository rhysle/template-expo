import assert from 'node:assert/strict'
import test from 'node:test'

import { appendFrequencyWaveformPath } from '../../src/components/audio/frequency-waveform-path.ts'

interface Point {
  x: number
  y: number
}

class RecordingPath {
  points: Point[] = []

  moveTo = (x: number, y: number) => {
    this.points.push({ x, y })
  }

  lineTo = (x: number, y: number) => {
    this.points.push({ x, y })
  }
}

const getVerticalTransitions = (points: Point[]): number[] =>
  points.flatMap((point, index) => {
    const nextPoint = points[index + 1]
    return nextPoint && point.x === nextPoint.x && point.y !== nextPoint.y ? [point.x] : []
  })

const render = (waveform: 'square' | 'sawtooth', phase: number) => {
  const path = new RecordingPath()
  appendFrequencyWaveformPath(path, {
    waveform,
    width: 440,
    centerY: 38,
    cycles: 2.767,
    phase,
    amplitude: 19,
  })
  return path.points
}

test('square discontinuities move by sub-pixel amounts on consecutive frames', () => {
  const initialX = getVerticalTransitions(render('square', 0.35))[0]
  const nextFrameX = getVerticalTransitions(render('square', 0.35 + 16.67 / 560))[0]

  assert.notEqual(initialX, undefined)
  assert.notEqual(nextFrameX, undefined)
  assert.ok(Math.abs(nextFrameX! - initialX!) > 0)
  assert.ok(Math.abs(nextFrameX! - initialX!) < 1)
})

test('sawtooth discontinuities move by sub-pixel amounts on consecutive frames', () => {
  const initialX = getVerticalTransitions(render('sawtooth', 0.35))[0]
  const nextFrameX = getVerticalTransitions(render('sawtooth', 0.35 + 16.67 / 560))[0]

  assert.notEqual(initialX, undefined)
  assert.notEqual(nextFrameX, undefined)
  assert.ok(Math.abs(nextFrameX! - initialX!) > 0)
  assert.ok(Math.abs(nextFrameX! - initialX!) < 1)
})
