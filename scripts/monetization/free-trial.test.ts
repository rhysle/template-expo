import assert from 'node:assert/strict'
import test from 'node:test'

import { monetizationConfig } from '../../src/configs/monetization'
import { AppleStoreClient } from './apple'
import { validateConfig } from './config'
import { APPLE_FREE_TRIAL_DURATION, GOOGLE_FREE_TRIAL_DURATION } from './free-trial'
import { GooglePlayClient } from './google'
import type { JsonRequester, JsonRequestOptions } from './http'
import { loadStoreLocalizations } from './localizations'
import { adjustedPriceUsd, RegionalPricingResolver } from './ppp'
import { Reporter } from './reporter'
import type { FreeTrialDuration, MonetizationConfig, SubscriptionProductKey } from './types'

interface RequestCall {
  path: string
  method: string
  body?: unknown
}

const makeConfig = (
  target: SubscriptionProductKey = 'weekly',
  duration: FreeTrialDuration = '3-days'
): MonetizationConfig => ({
  ...structuredClone(monetizationConfig),
  enabledProducts: ['weekly', 'monthly', 'yearly'],
  freeTrial: { target, duration },
})

const BILLING_PERIOD: Record<SubscriptionProductKey, string> = {
  weekly: 'P1W',
  monthly: 'P1M',
  yearly: 'P1Y',
}

const appleOffer = (
  id: string,
  duration: string,
  overrides: Partial<{
    numberOfPeriods: number
    offerMode: string
    targetSubscriptionPlanType: string
    territoryId: string
  }> = {}
) => ({
  id,
  type: 'subscriptionIntroductoryOffers',
  attributes: {
    duration,
    numberOfPeriods: overrides.numberOfPeriods ?? 1,
    offerMode: overrides.offerMode ?? 'FREE_TRIAL',
    targetSubscriptionPlanType: overrides.targetSubscriptionPlanType ?? 'UPFRONT',
  },
  relationships: {
    territory: {
      data: { type: 'territories', id: overrides.territoryId ?? 'USA' },
    },
  },
})

const appleRequester = (
  config: MonetizationConfig,
  offers: Partial<Record<SubscriptionProductKey, ReturnType<typeof appleOffer>[]>>
): { calls: RequestCall[]; request: JsonRequester } => {
  const calls: RequestCall[] = []
  const subscriptions = (['weekly', 'monthly', 'yearly'] as const).map((key) => ({
    id: `sub-${key}`,
    type: 'subscriptions',
    attributes: {
      name: key,
      productId: config.products[key].appleProductId,
      subscriptionPeriod: key,
    },
  }))

  const request: JsonRequester = async <T>(
    path: string,
    options: JsonRequestOptions = {}
  ): Promise<T | undefined> => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body })
    if (method === 'GET' && path.includes('/v1/apps?')) {
      return {
        data: [
          {
            id: 'app-1',
            type: 'apps',
            attributes: { bundleId: 'com.example.app', name: 'Example' },
          },
        ],
      } as T
    }
    if (method === 'GET' && path === '/v1/apps/app-1/subscriptionGroups?limit=200') {
      return {
        data: [
          {
            id: 'group-1',
            type: 'subscriptionGroups',
            attributes: { referenceName: config.apple.subscriptionGroupReferenceName },
          },
        ],
      } as T
    }
    if (method === 'GET' && path === '/v1/subscriptionGroups/group-1/subscriptions?limit=200') {
      return { data: subscriptions } as T
    }
    if (method === 'GET' && path.includes('/v1/territories?')) {
      return {
        data: ['USA', 'CAN'].map((id) => ({ id, type: 'territories', attributes: {} })),
      } as T
    }
    const introMatch = path.match(
      /^\/v1\/subscriptions\/sub-(weekly|monthly|yearly)\/introductoryOffers/
    )
    if (method === 'GET' && introMatch) {
      const key = introMatch[1] as SubscriptionProductKey
      return { data: offers[key] ?? [] } as T
    }
    if (method === 'POST' && path === '/v1/subscriptionIntroductoryOffers') {
      const body = options.body as {
        data: {
          attributes: { duration: string }
          relationships: {
            subscription: { data: { id: string } }
            territory: { data: { id: string } }
          }
        }
      }
      return {
        data: appleOffer(
          `new-trial-${body.data.relationships.territory.data.id}`,
          body.data.attributes.duration,
          { territoryId: body.data.relationships.territory.data.id }
        ),
      } as T
    }
    if (method === 'DELETE' && path.startsWith('/v1/subscriptionIntroductoryOffers/')) {
      return undefined
    }
    throw new Error(`Unexpected Apple request: ${method} ${path}`)
  }
  return { calls, request }
}

const runAppleActivation = async (
  config: MonetizationConfig,
  offers: Partial<Record<SubscriptionProductKey, ReturnType<typeof appleOffer>[]>>
): Promise<RequestCall[]> => {
  const mock = appleRequester(config, offers)
  const reporter = new Reporter('activate')
  const client = new AppleStoreClient(
    config,
    {
      bundleIdentifier: 'com.example.app',
      issuerId: 'issuer',
      keyId: 'key',
      keyFilepath: '/unused',
    },
    reporter,
    mock.request
  )
  await client.activate()
  reporter.finish()
  return mock.calls.filter((call) => call.method !== 'GET')
}

const runAppleTrialAudit = async (
  command: 'plan' | 'verify',
  config: MonetizationConfig,
  offers: Partial<Record<SubscriptionProductKey, ReturnType<typeof appleOffer>[]>>
): Promise<{ reporter: Reporter; calls: RequestCall[] }> => {
  const mock = appleRequester(config, offers)
  const reporter = new Reporter(command)
  const client = new AppleStoreClient(
    config,
    {
      bundleIdentifier: 'com.example.app',
      issuerId: 'issuer',
      keyId: 'key',
      keyFilepath: '/unused',
    },
    reporter,
    mock.request
  )
  const subscriptions = new Map(
    (['weekly', 'monthly', 'yearly'] as const).map((key) => [
      key,
      {
        id: `sub-${key}`,
        type: 'subscriptions',
        attributes: {
          name: key,
          productId: config.products[key].appleProductId,
          subscriptionPeriod: key,
        },
      },
    ])
  )
  const audit = client as unknown as {
    reconcileFreeTrial(value: typeof subscriptions): Promise<void>
  }
  await audit.reconcileFreeTrial(subscriptions)
  return { reporter, calls: mock.calls }
}

const money = (value: string) => {
  const [units, cents] = value.split('.')
  return { currencyCode: 'USD', units, nanos: Number(cents) * 10_000_000 }
}

const googleSubscription = (
  config: MonetizationConfig,
  otherRegionsNewSubscriberAvailability: boolean | 'omitted' = true
) => {
  const localizations = loadStoreLocalizations()
  const regionalPricing = new RegionalPricingResolver(config)
  const canadaMultiplier = regionalPricing.forGoogle('CA').multiplier
  return {
    packageName: 'com.example.app',
    productId: config.google.subscriptionProductId,
    basePlans: (['weekly', 'monthly', 'yearly'] as const).map((key) => ({
      basePlanId: config.products[key].googleBasePlanId,
      state: 'ACTIVE',
      regionalConfigs: [
        {
          regionCode: 'US',
          newSubscriberAvailability: true,
          price: money(config.products[key].priceUsd),
        },
        {
          regionCode: 'CA',
          newSubscriberAvailability: true,
          price: money(adjustedPriceUsd(config.products[key].priceUsd, canadaMultiplier)),
        },
      ],
      otherRegionsConfig: {
        usdPrice: money('1.00'),
        eurPrice: money('1.00'),
        ...(otherRegionsNewSubscriberAvailability === 'omitted'
          ? {}
          : { newSubscriberAvailability: otherRegionsNewSubscriberAvailability }),
      },
      autoRenewingBasePlanType: { billingPeriodDuration: BILLING_PERIOD[key] },
    })),
    listings: localizations.map((localization) => ({
      languageCode: localization.googleLocale,
      title: localization.google.subscription.title,
      benefits: localization.google.subscription.benefits,
      description: localization.google.subscription.description,
    })),
  }
}

const googleOffer = (
  config: MonetizationConfig,
  key: SubscriptionProductKey,
  state: 'DRAFT' | 'ACTIVE' | 'INACTIVE',
  overrides: Partial<{
    duration: string
    offerId: string
    eligibility: 'app' | 'plan'
    regions: string[]
    futureRegionsAvailable: boolean
  }> = {}
) => {
  const trial = config.freeTrial
  if (!trial) throw new Error('Test offer requires a configured trial')
  const regions = overrides.regions ?? ['CA', 'US']
  return {
    packageName: 'com.example.app',
    productId: config.google.subscriptionProductId,
    basePlanId: config.products[key].googleBasePlanId,
    offerId: overrides.offerId ?? config.google.freeTrialOfferId,
    state,
    phases: [
      {
        recurrenceCount: 1,
        duration: overrides.duration ?? GOOGLE_FREE_TRIAL_DURATION[trial.duration],
        regionalConfigs: regions.map((regionCode) => ({ regionCode, free: {} })),
        ...(overrides.futureRegionsAvailable === false ? {} : { otherRegionsConfig: { free: {} } }),
      },
    ],
    targeting: {
      acquisitionRule: {
        scope:
          overrides.eligibility === 'plan'
            ? { thisSubscription: {} }
            : { anySubscriptionInApp: {} },
      },
    },
    regionalConfigs: regions.map((regionCode) => ({
      regionCode,
      newSubscriberAvailability: true,
    })),
    otherRegionsConfig: {
      otherRegionsNewSubscriberAvailability: overrides.futureRegionsAvailable ?? true,
    },
    offerTags: [],
  }
}

const captureLogs = async (task: () => Promise<void>): Promise<string[]> => {
  const lines: string[] = []
  const original = console.log
  console.log = (value = '') => lines.push(String(value))
  try {
    await task()
  } finally {
    console.log = original
  }
  return lines
}

const googleRequester = (
  subscription: ReturnType<typeof googleSubscription>,
  offers: Partial<Record<SubscriptionProductKey, ReturnType<typeof googleOffer>[]>>
): { calls: RequestCall[]; request: JsonRequester } => {
  const calls: RequestCall[] = []
  const keyByPlanId = new Map(
    (['weekly', 'monthly', 'yearly'] as const).map((key) => [
      subscription.basePlans.find((plan) => plan.basePlanId === key)?.basePlanId ?? key,
      key,
    ])
  )
  const request: JsonRequester = async <T>(
    path: string,
    options: JsonRequestOptions = {}
  ): Promise<T | undefined> => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body })
    if (method === 'GET' && path === `/subscriptions/${subscription.productId}`) {
      return subscription as T
    }
    const listMatch = path.match(/\/basePlans\/([^/]+)\/offers(?:\?|$)/)
    if (method === 'GET' && listMatch) {
      const key = keyByPlanId.get(decodeURIComponent(listMatch[1]))
      return { subscriptionOffers: key ? (offers[key] ?? []) : [] } as T
    }
    if (method === 'POST' && path === '/pricing:convertRegionPrices') {
      const price = (options.body as { price: ReturnType<typeof money> }).price
      return {
        convertedRegionPrices: {
          US: { regionCode: 'US', price },
          CA: { regionCode: 'CA', price },
        },
        convertedOtherRegionsPrice: { usdPrice: money('1.00'), eurPrice: money('1.00') },
        regionVersion: { version: '2026-01' },
      } as T
    }
    if (
      (method === 'POST' || method === 'PATCH') &&
      path.includes('/basePlans/') &&
      path.includes('/offers') &&
      !path.endsWith(':activate') &&
      !path.endsWith(':deactivate')
    ) {
      return { ...(options.body as object), state: method === 'POST' ? 'DRAFT' : 'INACTIVE' } as T
    }
    if (method === 'POST' && (path.endsWith(':activate') || path.endsWith(':deactivate'))) {
      return {} as T
    }
    throw new Error(`Unexpected Google request: ${method} ${path}`)
  }
  return { calls, request }
}

const googleClient = (
  config: MonetizationConfig,
  command: 'plan' | 'apply' | 'verify' | 'activate',
  offers: Partial<Record<SubscriptionProductKey, ReturnType<typeof googleOffer>[]>>,
  otherRegionsNewSubscriberAvailability: boolean | 'omitted' = true
) => {
  const subscription = googleSubscription(config, otherRegionsNewSubscriberAvailability)
  const mock = googleRequester(subscription, offers)
  const reporter = new Reporter(command, { color: false })
  const client = new GooglePlayClient(
    config,
    { packageName: 'com.example.app', jsonKeyPath: '/unused' },
    reporter,
    mock.request
  )
  return { client, reporter, calls: mock.calls }
}

test('maps every shared trial duration to Apple and Google values', () => {
  assert.deepEqual(APPLE_FREE_TRIAL_DURATION, {
    '3-days': 'THREE_DAYS',
    '7-days': 'ONE_WEEK',
    '14-days': 'TWO_WEEKS',
    '1-month': 'ONE_MONTH',
    '2-months': 'TWO_MONTHS',
    '3-months': 'THREE_MONTHS',
    '6-months': 'SIX_MONTHS',
    '1-year': 'ONE_YEAR',
  })
  assert.equal(GOOGLE_FREE_TRIAL_DURATION['3-days'], 'P3D')
  assert.equal(GOOGLE_FREE_TRIAL_DURATION['7-days'], 'P7D')
})

test('validates that the trial target is enabled', () => {
  const config = makeConfig('monthly')
  config.enabledProducts = ['weekly', 'yearly']
  assert.throws(() => validateConfig(config), /freeTrial\.target monthly must be enabled/)
})

test('Apple creates the initial 3-day weekly trial in every storefront', async () => {
  const writes = await runAppleActivation(makeConfig(), {})
  assert.equal(writes.length, 2)
  assert.deepEqual(
    writes.map((call) => call.method),
    ['POST', 'POST']
  )
  const data = writes.map(
    (write) =>
      (
        write.body as {
          data: {
            attributes: object
            relationships: { territory: { data: { type: string; id: string } } }
          }
        }
      ).data
  )
  assert.deepEqual(data[0].attributes, {
    duration: 'THREE_DAYS',
    numberOfPeriods: 1,
    offerMode: 'FREE_TRIAL',
    startDate: new Date().toISOString().slice(0, 10),
    targetSubscriptionPlanType: 'UPFRONT',
  })
  assert.deepEqual(
    data
      .map((item) => item.relationships.territory.data)
      .sort((left, right) => left.id.localeCompare(right.id)),
    [
      { type: 'territories', id: 'CAN' },
      { type: 'territories', id: 'USA' },
    ]
  )
})

test('Apple creates the replacement before deleting an old duration', async () => {
  const config = makeConfig('weekly', '7-days')
  const writes = await runAppleActivation(config, {
    weekly: [appleOffer('old-trial', 'THREE_DAYS')],
  })
  assert.deepEqual(
    writes.map((call) => call.method),
    ['POST', 'POST', 'DELETE']
  )
  assert.equal(writes.at(-1)?.path, '/v1/subscriptionIntroductoryOffers/old-trial')
})

test('Apple moves the trial from weekly to yearly and cleans up duplicates', async () => {
  const config = makeConfig('yearly', '3-days')
  const writes = await runAppleActivation(config, {
    weekly: [appleOffer('old-weekly', 'THREE_DAYS')],
    yearly: [appleOffer('duplicate-yearly', 'ONE_WEEK')],
  })
  assert.deepEqual(
    writes.slice(0, 2).map((call) => call.method),
    ['POST', 'POST']
  )
  assert.deepEqual(
    writes
      .slice(2)
      .map((call) => call.path)
      .sort(),
    [
      '/v1/subscriptionIntroductoryOffers/duplicate-yearly',
      '/v1/subscriptionIntroductoryOffers/old-weekly',
    ]
  )
})

test('Apple removes managed trials when the config disables them', async () => {
  const config = makeConfig()
  config.freeTrial = null
  const writes = await runAppleActivation(config, {
    weekly: [appleOffer('old-trial', 'THREE_DAYS')],
  })
  assert.deepEqual(
    writes.map((call) => call.method),
    ['DELETE']
  )
})

test('Apple plan is read-only and verify rejects duplicate free trials', async () => {
  const config = makeConfig()
  const offers = {
    weekly: [appleOffer('trial-1', 'THREE_DAYS'), appleOffer('trial-2', 'THREE_DAYS')],
  }
  const plan = await runAppleTrialAudit('plan', config, offers)
  plan.reporter.finish()
  assert.equal(
    plan.calls.some((call) => call.method !== 'GET'),
    false
  )

  const verification = await runAppleTrialAudit('verify', config, offers)
  assert.throws(() => verification.reporter.finish(), /monetization configuration issue/)
})

test('Apple verify accepts exact all-storefront trial coverage', async () => {
  const config = makeConfig()
  const verification = await runAppleTrialAudit('verify', config, {
    weekly: [
      appleOffer('trial-usa', 'THREE_DAYS', { territoryId: 'USA' }),
      appleOffer('trial-can', 'THREE_DAYS', { territoryId: 'CAN' }),
    ],
  })
  verification.reporter.finish()
})

test('Apple verify audits an active trial when only lifetime is enabled', async () => {
  const config = makeConfig()
  config.enabledProducts = ['lifetime']
  config.freeTrial = null
  const mock = appleRequester(config, {
    weekly: [appleOffer('old-trial', 'THREE_DAYS')],
  })
  const reporter = new Reporter('verify', { color: false })
  const client = new AppleStoreClient(
    config,
    {
      bundleIdentifier: 'com.example.app',
      issuerId: 'issuer',
      keyId: 'key',
      keyFilepath: '/unused',
    },
    reporter,
    mock.request
  )
  const subscriptions = client as unknown as {
    appId: string
    syncSubscriptions(): Promise<void>
  }
  subscriptions.appId = 'app-1'

  await subscriptions.syncSubscriptions()

  assert.throws(() => reporter.finish(), /monetization configuration issue/)
})

test('Google apply creates an absent offer as a draft', async () => {
  const state = googleClient(makeConfig(), 'apply', {})
  await state.client.sync()
  state.reporter.finish()
  const create = state.calls.find(
    (call) => call.method === 'POST' && call.path.includes('/basePlans/weekly/offers?')
  )
  assert.ok(create)
  const body = create.body as { phases: Array<{ duration: string }> }
  assert.equal(body.phases[0].duration, 'P3D')
})

test('Google apply omits other-region phase pricing when future availability is absent', async () => {
  const state = googleClient(makeConfig(), 'apply', {}, 'omitted')
  await state.client.sync()
  const create = state.calls.find(
    (call) => call.method === 'POST' && call.path.includes('/basePlans/weekly/offers?')
  )
  assert.ok(create)
  const body = create.body as {
    phases: Array<{ otherRegionsConfig?: object }>
    otherRegionsConfig: { otherRegionsNewSubscriberAvailability: boolean }
  }
  assert.equal(Object.hasOwn(body.phases[0], 'otherRegionsConfig'), false)
  assert.equal(body.otherRegionsConfig.otherRegionsNewSubscriberAvailability, false)
})

test('Google plan is read-only when the free-trial offer is missing', async () => {
  const state = googleClient(makeConfig(), 'plan', {})
  await state.client.sync()
  state.reporter.finish()
  assert.equal(
    state.calls.some(
      (call) => call.method !== 'GET' && !call.path.includes('/pricing:convertRegionPrices')
    ),
    false
  )
})

test('Google plan explains a future-region-only free-trial transition', async () => {
  const config = makeConfig()
  const state = googleClient(config, 'plan', {
    weekly: [
      googleOffer(config, 'weekly', 'ACTIVE', {
        futureRegionsAvailable: false,
      }),
    ],
  })
  const lines = await captureLogs(async () => {
    await state.client.sync()
    state.reporter.finish()
  })

  assert.equal(
    lines.includes('  + Would update Google weekly free-trial future-region availability'),
    true
  )
  assert.equal(
    lines.some((line) => line.includes('transition Google weekly')),
    false
  )
})

test('Google apply refuses to mutate a mismatched active offer', async () => {
  const config = makeConfig('weekly', '7-days')
  const state = googleClient(config, 'apply', {
    weekly: [googleOffer(config, 'weekly', 'ACTIVE', { duration: 'P3D' })],
  })
  await state.client.sync()
  state.reporter.finish()
  assert.equal(
    state.calls.some((call) => call.method === 'PATCH'),
    false
  )
})

test('Google confirmed activation deactivates, patches, and reactivates a live duration change', async () => {
  const config = makeConfig('weekly', '7-days')
  const state = googleClient(config, 'activate', {
    weekly: [googleOffer(config, 'weekly', 'ACTIVE', { duration: 'P3D' })],
  })
  await state.client.activate()
  state.reporter.finish()
  const writes = state.calls.filter(
    (call) => call.method !== 'GET' && !call.path.includes('/pricing:convertRegionPrices')
  )
  assert.deepEqual(
    writes.map((call) => [call.method, call.path.split('?')[0].split(':').at(-1)]),
    [
      ['POST', 'deactivate'],
      [
        'PATCH',
        '//androidpublisher.googleapis.com/androidpublisher/v3/applications/com.example.app/subscriptions/premium/basePlans/weekly/offers/free-trial',
      ],
      ['POST', 'activate'],
    ]
  )
})

test('Google activates the new target before deactivating the previous target', async () => {
  const config = makeConfig('yearly', '3-days')
  const state = googleClient(config, 'activate', {
    weekly: [googleOffer(config, 'weekly', 'ACTIVE')],
    yearly: [googleOffer(config, 'yearly', 'DRAFT')],
  })
  await state.client.activate()
  state.reporter.finish()
  const stateChanges = state.calls.filter(
    (call) => call.path.endsWith(':activate') || call.path.endsWith(':deactivate')
  )
  assert.equal(stateChanges[0].path.includes('/basePlans/yearly/'), true)
  assert.equal(stateChanges[0].path.endsWith(':activate'), true)
  assert.equal(stateChanges[1].path.includes('/basePlans/weekly/'), true)
  assert.equal(stateChanges[1].path.endsWith(':deactivate'), true)
})

test('Google disables the default managed trial through confirmed activation', async () => {
  const enabled = makeConfig()
  const active = googleOffer(enabled, 'weekly', 'ACTIVE')
  const disabled = makeConfig()
  disabled.freeTrial = null
  const state = googleClient(disabled, 'activate', { weekly: [active] })
  await state.client.activate()
  state.reporter.finish()
  assert.equal(
    state.calls.some((call) => call.path.endsWith(':deactivate')),
    true
  )
})

test('Google disables a custom managed trial through confirmed activation', async () => {
  const enabled = makeConfig()
  enabled.freeTrial = { target: 'weekly', duration: '3-days' }
  enabled.google.freeTrialOfferId = 'intro-2026'
  const active = googleOffer(enabled, 'weekly', 'ACTIVE')
  const disabled = makeConfig()
  disabled.freeTrial = null
  disabled.google.freeTrialOfferId = 'intro-2026'
  const state = googleClient(disabled, 'activate', { weekly: [active] })
  await state.client.activate()
  state.reporter.finish()
  assert.equal(
    state.calls.some(
      (call) => call.path.includes('/offers/intro-2026:') && call.path.endsWith(':deactivate')
    ),
    true
  )
})

test('Google verify audits an active trial when only lifetime is enabled', async () => {
  const enabled = makeConfig()
  const active = googleOffer(enabled, 'weekly', 'ACTIVE')
  const config = makeConfig()
  config.enabledProducts = ['lifetime']
  config.freeTrial = null
  const state = googleClient(config, 'verify', { weekly: [active] })
  const subscriptions = state.client as unknown as {
    syncSubscription(): Promise<void>
  }

  await subscriptions.syncSubscription()

  assert.throws(() => state.reporter.finish(), /monetization configuration issue/)
})

test('Google verify rejects a configured base plan with the wrong billing period', async () => {
  const config = makeConfig()
  const state = googleClient(config, 'verify', {
    weekly: [googleOffer(config, 'weekly', 'ACTIVE')],
  })
  const subscription = state.client as unknown as {
    getSubscription(): Promise<ReturnType<typeof googleSubscription>>
  }
  const originalGetSubscription = subscription.getSubscription.bind(state.client)
  subscription.getSubscription = async () => {
    const value = await originalGetSubscription()
    return {
      ...value,
      basePlans: value.basePlans.map((plan) =>
        plan.basePlanId === config.products.weekly.googleBasePlanId
          ? { ...plan, autoRenewingBasePlanType: { billingPeriodDuration: 'P1M' } }
          : plan
      ),
    }
  }
  await state.client.sync()
  assert.throws(() => state.reporter.finish(), /monetization configuration issue/)
})

for (const [label, overrides] of [
  ['duration', { duration: 'P7D' }],
  ['eligibility', { eligibility: 'plan' as const }],
  ['regions', { regions: ['US'] }],
  ['future-region availability', { futureRegionsAvailable: false }],
] as const) {
  test(`Google verify rejects wrong ${label}`, async () => {
    const config = makeConfig()
    const state = googleClient(config, 'verify', {
      weekly: [googleOffer(config, 'weekly', 'ACTIVE', overrides)],
    })
    await state.client.sync()
    assert.throws(() => state.reporter.finish(), /monetization configuration issue/)
  })
}

test('Google verify rejects duplicate active managed offers', async () => {
  const config = makeConfig()
  const state = googleClient(config, 'verify', {
    weekly: [googleOffer(config, 'weekly', 'ACTIVE')],
    yearly: [googleOffer(config, 'yearly', 'ACTIVE')],
  })
  await state.client.sync()
  assert.throws(() => state.reporter.finish(), /monetization configuration issue/)
})

test('Google verify rejects a missing trial and an unknown active free offer', async () => {
  const missing = googleClient(makeConfig(), 'verify', {})
  await missing.client.sync()
  assert.throws(() => missing.reporter.finish(), /monetization configuration issue/)

  const config = makeConfig()
  const conflict = googleClient(config, 'verify', {
    weekly: [googleOffer(config, 'weekly', 'ACTIVE', { offerId: 'manual-trial' })],
  })
  await conflict.client.sync()
  assert.throws(() => conflict.reporter.finish(), /monetization configuration issue/)
})
