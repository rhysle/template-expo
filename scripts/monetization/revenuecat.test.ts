import assert from 'node:assert/strict'
import test from 'node:test'

import { monetizationConfig } from '../../src/configs/monetization'
import type { JsonRequester, JsonRequestOptions } from './http'
import { Reporter } from './reporter'
import { RevenueCatClient } from './revenuecat'
import type { Command, MonetizationConfig } from './types'

interface RequestCall {
  path: string
  method: string
  body?: unknown
}

interface RevenueCatState {
  product: {
    id: string
    app_id: string
    store_identifier: string
    type: string
    display_name: string
  }
  entitlement: { id: string; lookup_key: string; display_name: string }
  offering: {
    id: string
    lookup_key: string
    display_name: string
    is_current: boolean
  }
  packageItem: {
    id: string
    lookup_key: string
    display_name: string
    position: number
  }
}

const makeConfig = (): MonetizationConfig => {
  const config = structuredClone(monetizationConfig) as MonetizationConfig
  config.enabledProducts = ['weekly']
  config.freeTrial = { target: 'weekly', duration: '3-days' }
  config.stores = { apple: true, google: false, revenueCat: true }
  return config
}

const makeState = (config: MonetizationConfig): RevenueCatState => ({
  product: {
    id: 'product-1',
    app_id: 'app-apple',
    store_identifier: config.products.weekly.appleProductId,
    type: 'subscription',
    display_name: `${config.products.weekly.referenceName} (App Store)`,
  },
  entitlement: {
    id: 'entitlement-1',
    lookup_key: config.revenueCat.entitlementLookupKey,
    display_name: config.revenueCat.entitlementDisplayName,
  },
  offering: {
    id: 'offering-1',
    lookup_key: config.revenueCat.offeringLookupKey,
    display_name: config.revenueCat.offeringDisplayName,
    is_current: true,
  },
  packageItem: {
    id: 'package-1',
    lookup_key: config.products.weekly.revenueCatPackageLookupKey,
    display_name: config.products.weekly.referenceName,
    position: 0,
  },
})

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

const revenueCatRequester = (
  state: RevenueCatState
): { calls: RequestCall[]; request: JsonRequester } => {
  const calls: RequestCall[] = []
  const request: JsonRequester = async <T>(
    path: string,
    options: JsonRequestOptions = {}
  ): Promise<T | undefined> => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body })

    if (method === 'GET' && path.endsWith('/apps?limit=100')) {
      return {
        items: [
          {
            id: 'app-apple',
            name: 'Example App',
            type: 'app_store',
            app_store: { bundle_id: 'com.example.app' },
          },
        ],
      } as T
    }
    if (method === 'GET' && path.endsWith('/products?limit=100')) {
      return { items: [state.product] } as T
    }
    if (method === 'POST' && path === '/projects/project-1/products/product-1') {
      state.product = { ...state.product, ...(options.body as object) }
      return state.product as T
    }
    if (method === 'GET' && path.endsWith('/entitlements?limit=100')) {
      return { items: [state.entitlement] } as T
    }
    if (method === 'POST' && path === '/projects/project-1/entitlements/entitlement-1') {
      state.entitlement = { ...state.entitlement, ...(options.body as object) }
      return state.entitlement as T
    }
    if (method === 'GET' && path.includes('/entitlements/entitlement-1/products?')) {
      return { items: [{ product: state.product }] } as T
    }
    if (method === 'GET' && path.endsWith('/offerings?limit=100')) {
      return { items: [state.offering] } as T
    }
    if (method === 'POST' && path === '/projects/project-1/offerings/offering-1') {
      state.offering = { ...state.offering, ...(options.body as object) }
      return state.offering as T
    }
    if (method === 'GET' && path.includes('/offerings/offering-1/packages?')) {
      return { items: [state.packageItem] } as T
    }
    if (method === 'POST' && path === '/projects/project-1/packages/package-1') {
      const body = options.body as { display_name: string; position: number }
      state.packageItem = {
        ...state.packageItem,
        display_name: body.display_name,
        position: body.position - 1,
      }
      return state.packageItem as T
    }
    if (method === 'GET' && path.includes('/packages/package-1/products?')) {
      return { items: [{ product: state.product }] } as T
    }
    throw new Error(`Unexpected RevenueCat request: ${method} ${path}`)
  }
  return { calls, request }
}

const revenueCatClient = (command: Command, config: MonetizationConfig, state: RevenueCatState) => {
  const mock = revenueCatRequester(state)
  const reporter = new Reporter(command, { color: false })
  const client = new RevenueCatClient(
    config,
    {
      projectId: 'project-1',
      apiKey: 'secret',
      bundleIdentifier: 'com.example.app',
      packageName: 'com.example.app',
    },
    reporter,
    mock.request
  )
  return { client, reporter, calls: mock.calls }
}

test('RevenueCat apply reconciles mutable catalog metadata', async () => {
  const config = makeConfig()
  const state = makeState(config)
  state.product.display_name = 'Old product name'
  state.entitlement.display_name = 'Old entitlement name'
  state.offering.display_name = 'Old offering name'
  state.offering.is_current = false
  state.packageItem.display_name = 'Old package name'
  state.packageItem.position = 7
  const run = revenueCatClient('apply', config, state)

  await run.client.sync()
  run.reporter.finish()

  const updates = run.calls.filter(
    (call) => call.method === 'POST' && !call.path.includes('/actions/')
  )
  assert.deepEqual(
    updates.map((call) => [call.path, call.body]),
    [
      ['/projects/project-1/products/product-1', { display_name: 'Premium Weekly (App Store)' }],
      ['/projects/project-1/entitlements/entitlement-1', { display_name: 'Premium' }],
      [
        '/projects/project-1/offerings/offering-1',
        { display_name: 'Default Offering', is_current: true },
      ],
      ['/projects/project-1/packages/package-1', { display_name: 'Premium Weekly', position: 1 }],
    ]
  )
})

test('RevenueCat verify rejects mutable catalog metadata drift', async () => {
  const config = makeConfig()
  const state = makeState(config)
  state.entitlement.display_name = 'Old entitlement name'
  const run = revenueCatClient('verify', config, state)

  await run.client.sync()

  assert.throws(() => run.reporter.finish(), /monetization configuration issue/)
})

test('RevenueCat rejects an existing product with the wrong immutable type', async () => {
  const config = makeConfig()
  const state = makeState(config)
  state.product.type = 'non_consumable'
  const run = revenueCatClient('verify', config, state)

  await run.client.sync()

  assert.throws(() => run.reporter.finish(), /monetization configuration issue/)
})

test('RevenueCat uses store-specific lifetime product types', () => {
  const config = makeConfig()
  config.enabledProducts = ['lifetime']
  config.freeTrial = null
  config.stores = { apple: true, google: true, revenueCat: true }
  const client = new RevenueCatClient(
    config,
    {
      projectId: 'project-1',
      apiKey: 'secret',
      bundleIdentifier: 'com.example.app',
      packageName: 'com.example.app',
    },
    new Reporter('plan', { color: false })
  )
  const products = (
    client as unknown as {
      desiredProducts(apps: {
        appleAppId: string
        googleAppId: string
      }): Array<{ appId: string; type: string }>
    }
  ).desiredProducts({ appleAppId: 'app-apple', googleAppId: 'app-google' })

  assert.deepEqual(
    products.map((product) => [product.appId, product.type]),
    [
      ['app-apple', 'non_consumable'],
      ['app-google', 'one_time'],
    ]
  )
})

test('RevenueCat plan accepts zero-based package positions returned by the API', async () => {
  const config = makeConfig()
  const state = makeState(config)
  const run = revenueCatClient('plan', config, state)

  const lines = await captureLogs(async () => {
    await run.client.sync()
    run.reporter.finish()
  })

  assert.equal(lines.includes('No changes required.'), true)
})
