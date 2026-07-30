import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DB_METER_INDICATOR_ANCHOR,
  DB_METER_INDICATOR_SIZE,
  getDbMeterGradientDirection,
  getDbMeterIndicatorTranslation,
} from './dbMeterGaugeLayout'

void test('uses one logical start anchor and lets React Native mirror it in RTL', () => {
  assert.deepEqual(DB_METER_INDICATOR_ANCHOR, { left: 0 })
})

void test('mirrors the meter gradient in RTL', () => {
  assert.deepEqual(getDbMeterGradientDirection(false), {
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
  })
  assert.deepEqual(getDbMeterGradientDirection(true), {
    start: { x: 1, y: 0.5 },
    end: { x: 0, y: 0.5 },
  })
})

void test('mirrors the meter indicator movement without changing its endpoint overflow', () => {
  const trackWidth = 300

  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const ltrTranslation = getDbMeterIndicatorTranslation(progress, trackWidth, false)
    const rtlTranslation = getDbMeterIndicatorTranslation(progress, trackWidth, true)
    const rtlPhysicalLeft = trackWidth - DB_METER_INDICATOR_SIZE + rtlTranslation

    assert.equal(rtlPhysicalLeft, trackWidth - DB_METER_INDICATOR_SIZE - ltrTranslation)
  }

  assert.ok(getDbMeterIndicatorTranslation(1, trackWidth, false) > 0)
  assert.ok(getDbMeterIndicatorTranslation(1, trackWidth, true) < 0)
})
