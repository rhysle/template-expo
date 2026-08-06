import assert from 'node:assert/strict'
import test from 'node:test'

import { AppleStoreClient } from './apple'
import { GooglePlayClient } from './google'
import type { JsonRequester } from './http'
import { Reporter } from './reporter'
import type { GoogleConvertedPrices, GoogleMoney, MonetizationConfig } from './types'

const money = (price: string): GoogleMoney => {
  const [units, cents] = price.split('.')
  return { currencyCode: 'USD', units, nanos: Number(cents) * 10_000_000 }
}

const config = (priceUsd = '3.99'): MonetizationConfig => ({
  enabledProducts: ['weekly'],
  freeTrial: null,
  stores: { apple: false, google: true, revenueCat: false },
  regionalPricing: {
    strategy: 'ppp-bands',
    dataset: 'world-bank-2025',
    bands: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2],
    countryOverrides: { CH: 0.5 },
  },
  products: {
    weekly: {
      priceUsd,
      referenceName: 'Weekly',
      appleProductId: 'weekly',
      googleBasePlanId: 'weekly',
      revenueCatPackageLookupKey: '$rc_weekly',
    },
    monthly: {
      priceUsd: '9.99',
      referenceName: 'Monthly',
      appleProductId: 'monthly',
      googleBasePlanId: 'monthly',
      revenueCatPackageLookupKey: '$rc_monthly',
    },
    yearly: {
      priceUsd: '29.99',
      referenceName: 'Yearly',
      appleProductId: 'yearly',
      googleBasePlanId: 'yearly',
      revenueCatPackageLookupKey: '$rc_annual',
    },
    lifetime: {
      priceUsd: '59.99',
      referenceName: 'Lifetime',
      appleProductId: 'lifetime',
      googleProductId: 'lifetime',
      googlePurchaseOptionId: 'buy',
      revenueCatPackageLookupKey: '$rc_lifetime',
    },
  },
  apple: {
    subscriptionGroupReferenceName: 'Premium',
    baseTerritory: 'USA',
    familySharable: false,
    reviewNote: 'Premium',
  },
  google: { subscriptionProductId: 'premium' },
  revenueCat: {
    entitlementLookupKey: 'premium',
    entitlementDisplayName: 'Premium',
    offeringLookupKey: 'default',
    offeringDisplayName: 'Default',
    makeOfferingCurrent: true,
  },
})

const conversion = (price: GoogleMoney): GoogleConvertedPrices => ({
  convertedRegionPrices: {
    US: { regionCode: 'US', price },
    CH: { regionCode: 'CH', price },
  },
  convertedOtherRegionsPrice: { usdPrice: price, eurPrice: { ...price, currencyCode: 'EUR' } },
  regionVersion: { version: '2025/01' },
})

test('new Google products receive their final PPP matrix during monetization apply', async () => {
  const calls: Array<{ path: string; method: string; body?: unknown }> = []
  const request: JsonRequester = async <T>(path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body })
    if (path.includes('pricing:convertRegionPrices')) {
      const price = (options.body as { price: GoogleMoney }).price
      return conversion(price) as T
    }
    if (method === 'POST' && path.includes('/subscriptions?')) return options.body as T
    if (path.includes('/basePlans/') && path.includes('/offers')) {
      return { subscriptionOffers: [] } as T
    }
    return undefined
  }
  const client = new GooglePlayClient(
    config(),
    { packageName: 'com.example.app', jsonKeyPath: '/unused' },
    new Reporter('apply', { color: false }),
    request
  )
  await client.sync()
  const create = calls.find(
    (call) => call.method === 'POST' && call.path.includes('/subscriptions?')
  )
  assert.ok(create)
  const basePlan = (
    create.body as {
      basePlans: Array<{ regionalConfigs: Array<{ regionCode: string; price: GoogleMoney }> }>
    }
  ).basePlans[0]
  const prices = new Map(basePlan.regionalConfigs.map((item) => [item.regionCode, item.price]))
  assert.deepEqual(prices.get('US'), money('3.99'))
  assert.deepEqual(prices.get('CH'), money('2.00'))
})

test('a later price decrease patches the complete matrix and migrates legacy cohorts', async () => {
  const calls: Array<{ path: string; method: string; body?: unknown }> = []
  const current = {
    packageName: 'com.example.app',
    productId: 'premium',
    listings: [],
    basePlans: [
      {
        basePlanId: 'weekly',
        state: 'ACTIVE',
        regionalConfigs: [
          { regionCode: 'US', newSubscriberAvailability: true, price: money('5.99') },
          { regionCode: 'CH', newSubscriberAvailability: true, price: money('3.00') },
        ],
        otherRegionsConfig: {
          usdPrice: money('5.99'),
          eurPrice: { ...money('5.99'), currencyCode: 'EUR' },
          newSubscriberAvailability: true,
        },
        autoRenewingBasePlanType: { billingPeriodDuration: 'P1W' },
      },
    ],
  }
  const request: JsonRequester = async <T>(path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body })
    if (path.includes('pricing:convertRegionPrices')) {
      return conversion((options.body as { price: GoogleMoney }).price) as T
    }
    if (method === 'PATCH' && path.includes('/subscriptions/')) return options.body as T
    if (method === 'POST' && path.includes(':migratePrices')) return {} as T
    if (path.includes('/subscriptions/premium')) return current as T
    return undefined
  }
  const client = new GooglePlayClient(
    config('4.99'),
    { packageName: 'com.example.app', jsonKeyPath: '/unused' },
    new Reporter('prices-apply', { color: false }),
    request
  )
  await client.syncPrices()
  assert.ok(calls.some((call) => call.method === 'PATCH'))
  const migration = calls.find((call) => call.path.includes(':migratePrices'))
  assert.ok(migration)
  assert.deepEqual(
    (
      migration.body as { regionalPriceMigrations: Array<{ regionCode: string }> }
    ).regionalPriceMigrations.map((item) => item.regionCode),
    ['US', 'CH']
  )
  assert.notEqual(
    (
      migration.body as {
        regionalPriceMigrations: Array<{ oldestAllowedPriceVersionTime: string }>
      }
    ).regionalPriceMigrations[0].oldestAllowedPriceVersionTime,
    '1970-01-01T00:00:00Z'
  )
})

test('Apple later pricing preserves increases but passes decreases to existing subscribers', async () => {
  const calls: Array<{ path: string; method: string; body?: unknown }> = []
  const request: JsonRequester = async <T>(path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body })
    if (path.includes('/v1/apps?')) {
      return {
        data: [
          {
            type: 'apps',
            id: 'app-1',
            attributes: { bundleId: 'com.example.app', name: 'Example' },
          },
        ],
      } as T
    }
    if (path.includes('/subscriptionGroups?')) {
      return {
        data: [
          { type: 'subscriptionGroups', id: 'group-1', attributes: { referenceName: 'Premium' } },
        ],
      } as T
    }
    if (path.includes('/subscriptionGroups/group-1/subscriptions')) {
      return {
        data: [
          {
            type: 'subscriptions',
            id: 'sub-1',
            attributes: { productId: 'weekly', name: 'Weekly', subscriptionPeriod: 'ONE_WEEK' },
          },
        ],
      } as T
    }
    if (path.includes('/v1/subscriptions/sub-1/pricePoints')) {
      return {
        data: ['2.49', '2.50', '3.99', '4.99'].map((customerPrice) => ({
          type: 'subscriptionPricePoints',
          id: `usa-${customerPrice}`,
          attributes: { customerPrice },
          relationships: { territory: { data: { type: 'territories', id: 'USA' } } },
        })),
      } as T
    }
    if (path.includes('/v1/territories')) {
      return {
        data: ['USA', 'CHE'].map((id) => ({ type: 'territories', id, attributes: {} })),
      } as T
    }
    if (path.includes('/equalizations')) {
      const target = path.includes('usa-2.50') ? '2.50' : '4.99'
      return {
        data: [
          {
            type: 'subscriptionPricePoints',
            id: `che-${target}`,
            attributes: { customerPrice: target },
            relationships: { territory: { data: { type: 'territories', id: 'CHE' } } },
          },
        ],
      } as T
    }
    if (path.includes('/v1/subscriptions/sub-1/prices')) {
      return {
        data: [
          {
            type: 'subscriptionPrices',
            id: 'current-us',
            attributes: { startDate: null },
            relationships: {
              subscriptionPricePoint: {
                data: { type: 'subscriptionPricePoints', id: 'usa-3.99' },
              },
            },
          },
          {
            type: 'subscriptionPrices',
            id: 'current-ch',
            attributes: { startDate: null },
            relationships: {
              subscriptionPricePoint: {
                data: { type: 'subscriptionPricePoints', id: 'che-3.00' },
              },
            },
          },
        ],
        included: [
          {
            type: 'subscriptionPricePoints',
            id: 'usa-3.99',
            attributes: { customerPrice: '3.99' },
            relationships: { territory: { data: { type: 'territories', id: 'USA' } } },
          },
          {
            type: 'subscriptionPricePoints',
            id: 'che-3.00',
            attributes: { customerPrice: '3.00' },
            relationships: { territory: { data: { type: 'territories', id: 'CHE' } } },
          },
        ],
      } as T
    }
    return undefined
  }
  const client = new AppleStoreClient(
    { ...config('4.99'), stores: { apple: true, google: false, revenueCat: false } },
    {
      bundleIdentifier: 'com.example.app',
      issuerId: 'unused',
      keyId: 'unused',
      keyFilepath: '/unused',
    },
    new Reporter('prices-apply', { color: false }),
    request
  )
  await client.syncPrices()
  const writes = calls.filter(
    (call) => call.method === 'POST' && call.path === '/v1/subscriptionPrices'
  )
  assert.equal(writes.length, 2)
  const preserveByPoint = new Map(
    writes.map((call) => {
      const data = (
        call.body as {
          data: {
            attributes: { preserveCurrentPrice: boolean }
            relationships: { subscriptionPricePoint: { data: { id: string } } }
          }
        }
      ).data
      return [
        data.relationships.subscriptionPricePoint.data.id,
        data.attributes.preserveCurrentPrice,
      ]
    })
  )
  assert.equal(preserveByPoint.get('usa-4.99'), true)
  assert.equal(preserveByPoint.get('che-2.50'), false)
})

test('new and partially provisioned Apple subscriptions receive missing PPP storefront prices', async () => {
  const run = async (withUsPrice: boolean): Promise<string[]> => {
    const posted: string[] = []
    const request: JsonRequester = async <T>(path, options = {}) => {
      if (path.includes('/v1/subscriptions/sub-1/pricePoints')) {
        return {
          data: ['2.50', '4.99'].map((customerPrice) => ({
            type: 'subscriptionPricePoints',
            id: `usa-${customerPrice}`,
            attributes: { customerPrice },
            relationships: { territory: { data: { type: 'territories', id: 'USA' } } },
          })),
        } as T
      }
      if (path.includes('/v1/territories')) {
        return {
          data: ['USA', 'CHE'].map((id) => ({ type: 'territories', id, attributes: {} })),
        } as T
      }
      if (path.includes('/equalizations')) {
        const target = path.includes('usa-2.50') ? '2.50' : '4.99'
        return {
          data: [
            {
              type: 'subscriptionPricePoints',
              id: `che-${target}`,
              attributes: { customerPrice: target },
              relationships: { territory: { data: { type: 'territories', id: 'CHE' } } },
            },
          ],
        } as T
      }
      if (path.includes('/v1/subscriptions/sub-1/prices')) {
        return withUsPrice
          ? ({
              data: [
                {
                  type: 'subscriptionPrices',
                  id: 'current-us',
                  attributes: { startDate: null },
                  relationships: {
                    subscriptionPricePoint: {
                      data: { type: 'subscriptionPricePoints', id: 'usa-4.99' },
                    },
                  },
                },
              ],
              included: [
                {
                  type: 'subscriptionPricePoints',
                  id: 'usa-4.99',
                  attributes: { customerPrice: '4.99' },
                  relationships: { territory: { data: { type: 'territories', id: 'USA' } } },
                },
              ],
            } as T)
          : ({ data: [], included: [] } as T)
      }
      if (path === '/v1/subscriptionPrices' && options.method === 'POST') {
        posted.push(
          (
            options.body as {
              data: { relationships: { subscriptionPricePoint: { data: { id: string } } } }
            }
          ).data.relationships.subscriptionPricePoint.data.id
        )
      }
      return undefined
    }
    const client = new AppleStoreClient(
      { ...config('4.99'), stores: { apple: true, google: false, revenueCat: false } },
      {
        bundleIdentifier: 'com.example.app',
        issuerId: 'unused',
        keyId: 'unused',
        keyFilepath: '/unused',
      },
      new Reporter('apply', { color: false }),
      request
    )
    await (
      client as unknown as {
        reconcileSubscriptionPrice: (
          subscriptionId: string,
          key: 'weekly',
          laterChange: boolean
        ) => Promise<void>
      }
    ).reconcileSubscriptionPrice('sub-1', 'weekly', false)
    return posted.sort()
  }

  assert.deepEqual(await run(false), ['che-2.50', 'usa-4.99'])
  assert.deepEqual(await run(true), ['che-2.50'])
})
