import assert from 'node:assert/strict'
import test from 'node:test'

import { monetizationConfig } from '../../src/configs/monetization'
import { resolveMonetizationConfig } from './config'
import type { MonetizationConfig } from './types'

const sourceConfig = (): MonetizationConfig =>
  structuredClone(monetizationConfig) as MonetizationConfig

test('Apple product IDs are prefixed with the full iOS bundle identifier', () => {
  const resolved = resolveMonetizationConfig(sourceConfig(), 'com.example.speaker-cleaner')

  assert.equal(
    resolved.products.weekly.appleProductId,
    'com.example.speaker-cleaner.premium_weekly'
  )
  assert.equal(
    resolved.products.lifetime.appleProductId,
    'com.example.speaker-cleaner.premium_lifetime'
  )
})

test('resolving Apple IDs does not change Google product IDs', () => {
  const source = sourceConfig()
  const resolved = resolveMonetizationConfig(source, 'com.example.speaker-cleaner')

  assert.equal(resolved.google.subscriptionProductId, source.google.subscriptionProductId)
  assert.equal(resolved.products.lifetime.googleProductId, source.products.lifetime.googleProductId)
})

test('resolved Apple product IDs must stay within the App Store limit', () => {
  const source = sourceConfig()
  source.products.weekly.appleProductId = 'x'.repeat(90)

  assert.throws(
    () => resolveMonetizationConfig(source, 'com.example.speaker-cleaner'),
    /weekly\.appleProductId.*at most 100 characters/
  )
})
