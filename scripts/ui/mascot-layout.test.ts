import assert from 'node:assert/strict'
import test from 'node:test'

import { getMascotLayout, isMascotLayoutReady } from '../../src/components/audio/mascot-layout.ts'

test('keeps a measured fluid mascot ready while another screen covers its tab', () => {
  const layout = getMascotLayout(600, 600)

  assert.equal(isMascotLayoutReady(true, undefined), false)
  assert.equal(isMascotLayoutReady(true, layout), true)
  assert.equal(isMascotLayoutReady(false, undefined), true)
})

test('fills a landscape mascot slot using the visible image bounds', () => {
  const layout = getMascotLayout(897, 699)

  assert.equal(Math.round(layout.frameWidth), 897)
  assert.equal(Math.round(layout.frameHeight), 699)
})

test('uses available height when a banner shortens the mascot slot', () => {
  const layout = getMascotLayout(897, 620)

  assert.equal(Math.round(layout.frameHeight), 620)
  assert.ok(layout.frameWidth < 897)
})

test('maps the source alpha bounds exactly onto the visible frame', () => {
  const layout = getMascotLayout(600, 600)

  assert.equal(Math.round(layout.imageLeft + 144 * layout.scale), 0)
  assert.equal(Math.round(layout.imageTop + 208 * layout.scale), 0)
  assert.equal(Math.round(760 * layout.scale), Math.round(layout.frameWidth))
  assert.equal(Math.round(592 * layout.scale), Math.round(layout.frameHeight))
})
