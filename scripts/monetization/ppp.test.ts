import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPppSnapshot } from './ppp-dataset'
import type { WorldBankObservation } from './ppp-dataset'
import { requireCommandConfirmation } from './confirmation'
import {
  adjustedPriceUsd,
  formatMoney,
  RegionalPricingResolver,
  selectClosestUsdPrice,
  selectNearestBand,
  validateMoneyPrecision,
} from './ppp'
import type { MonetizationConfig } from './types'

const bands = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2] as const

test('selects all PPP bands, premiums, and the lower band on a tie', () => {
  assert.deepEqual(
    bands.map((band) => selectNearestBand(band, bands)),
    [...bands]
  )
  assert.equal(selectNearestBand(0.45, bands), 0.4)
  assert.equal(selectNearestBand(1.15, bands), 1.1)
  assert.equal(selectNearestBand(1.8, bands), 1.2)
})

test('calculates adjusted USD anchors with integer cents and half-up rounding', () => {
  assert.equal(adjustedPriceUsd('3.99', 0.7), '2.79')
  assert.equal(adjustedPriceUsd('4.99', 1.2), '5.99')
  assert.equal(adjustedPriceUsd('0.05', 0.5), '0.03')
})

test('selects the lower Apple point on an exact price tie', () => {
  const points = ['2.99', '3.99'].map((customerPrice) => ({ attributes: { customerPrice } }))
  assert.equal(selectClosestUsdPrice('3.49', points).attributes.customerPrice, '2.99')
  const compactApplePoints = ['0.9', '1.0'].map((customerPrice) => ({
    attributes: { customerPrice },
  }))
  assert.equal(selectClosestUsdPrice('0.95', compactApplePoints).attributes.customerPrice, '0.9')
  assert.throws(() => selectClosestUsdPrice('3.49', []), /No store price points/)
})

const observation = (
  iso2: string,
  iso3: string,
  name: string,
  year: number,
  value: number | null
): WorldBankObservation => ({
  country: { id: iso2, value: name },
  countryiso3code: iso3,
  date: String(year),
  value,
})

test('pairs indicators by country and year, falls back, and normalizes with same-year US data', () => {
  const ppp = [
    observation('US', 'USA', 'United States', 2025, 1),
    observation('US', 'USA', 'United States', 2024, 1),
    observation('CH', 'CHE', 'Switzerland', 2025, 0.9),
    observation('VN', 'VNM', 'Vietnam', 2025, 12_000),
    observation('VN', 'VNM', 'Vietnam', 2024, 11_000),
    observation('ZZ', 'ZZZ', 'No Data', 2025, null),
  ]
  const exchange = [
    observation('US', 'USA', 'United States', 2025, 1),
    observation('US', 'USA', 'United States', 2024, 1),
    observation('CH', 'CHE', 'Switzerland', 2025, 0.8),
    observation('VN', 'VNM', 'Vietnam', 2025, null),
    observation('VN', 'VNM', 'Vietnam', 2024, 22_000),
    observation('ZZ', 'ZZZ', 'No Data', 2025, 2),
  ]
  const snapshot = buildPppSnapshot({
    targetYear: 2025,
    retrievedAt: '2026-01-01T00:00:00.000Z',
    worldBankLastUpdated: '2025-12-01',
    pppObservations: ppp,
    exchangeObservations: exchange,
  })
  assert.equal(snapshot.countries.find((item) => item.iso2 === 'CH')?.sourceYear, 2025)
  assert.equal(snapshot.countries.find((item) => item.iso2 === 'CH')?.normalizedRatio, 1.125)
  assert.equal(snapshot.countries.find((item) => item.iso2 === 'VN')?.sourceYear, 2024)
  assert.equal(snapshot.countries.find((item) => item.iso2 === 'VN')?.normalizedRatio, 0.5)
  assert.equal(
    snapshot.countries.some((item) => item.iso2 === 'ZZ'),
    false
  )
  assert.equal(snapshot.indicators.pppConversionFactor, 'PA.NUS.PPP')
})

test('forces the US to 1.0, applies overrides, and falls back when data is absent', () => {
  const config = {
    regionalPricing: {
      strategy: 'ppp-bands',
      dataset: 'world-bank-2025',
      bands,
      countryOverrides: { CH: 0.9, GI: 0.9 },
    },
  } as MonetizationConfig
  const resolver = new RegionalPricingResolver(config)
  assert.equal(resolver.snapshot?.targetYear, 2025)
  assert.equal(resolver.forGoogle('VN').sourceYear, 2024)
  assert.equal(resolver.forGoogle('CH').sourceYear, 2025)
  assert.equal(resolver.forGoogle('US').multiplier, 1)
  assert.equal(resolver.forGoogle('CH').multiplier, 0.9)
  assert.equal(resolver.forGoogle('CH').overridden, true)
  assert.deepEqual(resolver.forGoogle('GI'), {
    iso2: 'GI',
    iso3: 'GIB',
    countryName: 'Gibraltar',
    multiplier: 0.9,
    overridden: true,
    fallback: false,
  })
  assert.equal(resolver.forApple('GIB').multiplier, 0.9)
  assert.equal(resolver.forApple('GIB').overridden, true)
  assert.deepEqual(resolver.forGoogle('ZZ'), {
    multiplier: 1,
    overridden: false,
    fallback: true,
  })
})

test('formats zero- and two-decimal currencies and validates three-decimal precision', () => {
  assert.equal(formatMoney({ currencyCode: 'VND', units: '99000' }), '₫99,000')
  assert.equal(formatMoney({ currencyCode: 'JPY', units: '500' }), '¥500')
  assert.equal(formatMoney({ currencyCode: 'KRW', units: '4900' }), '₩4,900')
  assert.equal(formatMoney({ currencyCode: 'USD', units: '2', nanos: 790_000_000 }), '$2.79')
  assert.doesNotThrow(() =>
    validateMoneyPrecision({ currencyCode: 'KWD', units: '1', nanos: 234_000_000 })
  )
  assert.throws(() =>
    validateMoneyPrecision({ currencyCode: 'KWD', units: '1', nanos: 234_500_000 })
  )
})

test('requires explicit confirmation only for price application and activation', () => {
  assert.throws(() => requireCommandConfirmation('prices-apply', []), /--confirm/)
  assert.throws(() => requireCommandConfirmation('activate', []), /--confirm/)
  assert.doesNotThrow(() => requireCommandConfirmation('prices-apply', ['--confirm']))
  assert.doesNotThrow(() => requireCommandConfirmation('prices-plan', []))
  assert.doesNotThrow(() => requireCommandConfirmation('prices-verify', []))
})
