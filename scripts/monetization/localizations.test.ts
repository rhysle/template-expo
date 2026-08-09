import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { monetizationConfig } from '../../src/configs/monetization'
import { AppleMetadataReconciler } from './apple-metadata'
import { GooglePlayClient } from './google'
import { loadStoreLocalizations, loadStoreLocalizationsFromDirectory } from './localizations'
import { Reporter } from './reporter'
import { RevenueCatClient } from './revenuecat'
import type { MonetizationConfig, StoreLocalization } from './types'

const EXPECTED_LOCALES = [
  'ar',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'nb',
  'nl',
  'pl',
  'pt',
  'pt-BR',
  'ro',
  'ru',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-Hans',
  'zh-Hant',
].sort((left, right) => left.localeCompare(right))

interface TestLocalizationFile {
  appleLocale: string
  googleLocale: string
  apple: {
    subscriptionGroupDisplayName: string
    products: Record<
      'weekly' | 'monthly' | 'yearly' | 'lifetime',
      { displayName: string; description: string }
    >
  }
  google: {
    subscription: { title: string; description: string; benefits: string[] }
    lifetime: { title: string; description: string }
  }
}

const validFile = (): TestLocalizationFile => ({
  appleLocale: 'en-US',
  googleLocale: 'en-US',
  apple: {
    subscriptionGroupDisplayName: 'Premium',
    products: {
      weekly: { displayName: 'Premium · Weekly', description: 'Full premium access.' },
      monthly: { displayName: 'Premium · Monthly', description: 'Full premium access.' },
      yearly: { displayName: 'Premium · Yearly', description: 'Full premium access.' },
      lifetime: { displayName: 'Premium · Lifetime', description: 'Lifetime premium access.' },
    },
  },
  google: {
    subscription: {
      title: 'Premium',
      description: 'Full premium access.',
      benefits: ['All premium features'],
    },
    lifetime: { title: 'Premium · Lifetime', description: 'Lifetime premium access.' },
  },
})

const withTempDirectory = (run: (directory: string) => void): void => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monetization-localizations-'))
  try {
    run(directory)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

const writeFile = (
  directory: string,
  locale: string,
  value: TestLocalizationFile | string
): void => {
  fs.writeFileSync(
    path.join(directory, `${locale}.json`),
    typeof value === 'string' ? value : JSON.stringify(value)
  )
}

test('loads every explicit store locale in deterministic order', () => {
  const localizations = loadStoreLocalizations()
  assert.deepEqual(
    localizations.map((localization) => localization.sourceLocale),
    EXPECTED_LOCALES
  )
  assert.equal(localizations.length, 33)
})

test('loads the exact English store metadata defaults', () => {
  const english = loadStoreLocalizations().find(
    (localization) => localization.sourceLocale === 'en'
  )
  assert.ok(english)
  assert.deepEqual(english.apple.products, {
    weekly: {
      displayName: 'Premium · Weekly',
      description: 'Full access to all premium features.',
    },
    monthly: {
      displayName: 'Premium · Monthly',
      description: 'Full access to all premium features.',
    },
    yearly: {
      displayName: 'Premium · Yearly',
      description: 'Full access to all premium features.',
    },
    lifetime: {
      displayName: 'Premium · Lifetime',
      description: 'Lifetime access to all premium features.',
    },
  })
  assert.deepEqual(english.google, {
    subscription: {
      title: 'Premium',
      description: 'Full access to all premium features.',
      benefits: ['Access all premium features'],
    },
    lifetime: {
      title: 'Premium · Lifetime',
      description: 'Lifetime access to all premium features.',
    },
  })
})

test('rejects malformed JSON, missing products, and unexpected fields', () => {
  withTempDirectory((directory) => {
    writeFile(directory, 'en', '{broken')
    assert.throws(() => loadStoreLocalizationsFromDirectory(directory), /Unable to read/)
  })
  withTempDirectory((directory) => {
    const value = validFile()
    delete (value.apple.products as Partial<typeof value.apple.products>).monthly
    writeFile(directory, 'en', value)
    assert.throws(
      () => loadStoreLocalizationsFromDirectory(directory),
      /must contain exactly: lifetime, monthly, weekly, yearly/
    )
  })
  withTempDirectory((directory) => {
    const value = validFile() as TestLocalizationFile & { unexpected?: string }
    value.unexpected = 'value'
    writeFile(directory, 'en', value)
    assert.throws(() => loadStoreLocalizationsFromDirectory(directory), /must contain exactly/)
  })
})

test('rejects blank values and duplicate store locale codes', () => {
  withTempDirectory((directory) => {
    const value = validFile()
    value.apple.products.weekly.description = '   '
    writeFile(directory, 'en', value)
    assert.throws(() => loadStoreLocalizationsFromDirectory(directory), /nonblank string/)
  })
  withTempDirectory((directory) => {
    writeFile(directory, 'en', validFile())
    writeFile(directory, 'fr', validFile())
    assert.throws(() => loadStoreLocalizationsFromDirectory(directory), /Duplicate Apple locale/)
  })
  withTempDirectory((directory) => {
    const french = validFile()
    french.appleLocale = 'fr-FR'
    writeFile(directory, 'en', validFile())
    writeFile(directory, 'fr', french)
    assert.throws(() => loadStoreLocalizationsFromDirectory(directory), /Duplicate Google locale/)
  })
})

test('accepts Apple name and description boundary lengths', () => {
  for (const [nameLength, descriptionLength] of [
    [2, 1],
    [35, 55],
  ] as const) {
    withTempDirectory((directory) => {
      const value = validFile()
      value.apple.products.weekly.displayName = 'n'.repeat(nameLength)
      value.apple.products.weekly.description = 'd'.repeat(descriptionLength)
      writeFile(directory, 'en', value)
      assert.equal(loadStoreLocalizationsFromDirectory(directory).length, 1)
    })
  }
})

test('rejects Apple names over 35 and descriptions over 55 characters', () => {
  withTempDirectory((directory) => {
    const value = validFile()
    value.apple.products.weekly.displayName = 'n'.repeat(36)
    writeFile(directory, 'en', value)
    assert.throws(() => loadStoreLocalizationsFromDirectory(directory), /must be 2-35/)
  })
  withTempDirectory((directory) => {
    const value = validFile()
    value.apple.products.weekly.description = 'd'.repeat(56)
    writeFile(directory, 'en', value)
    assert.throws(() => loadStoreLocalizationsFromDirectory(directory), /exceeds 55/)
  })
})

test('enforces Google title, description, benefit, and benefit-count limits', () => {
  const invalidValues: Array<[RegExp, (value: TestLocalizationFile) => void]> = [
    [/title exceeds 55/, (value) => (value.google.subscription.title = 't'.repeat(56))],
    [
      /description exceeds 200/,
      (value) => (value.google.subscription.description = 'd'.repeat(201)),
    ],
    [
      /benefits\[0\] exceeds 40/,
      (value) => (value.google.subscription.benefits = ['b'.repeat(41)]),
    ],
    [/must contain 1-4 benefits/, (value) => (value.google.subscription.benefits = [])],
    [
      /must contain 1-4 benefits/,
      (value) => (value.google.subscription.benefits = ['1', '2', '3', '4', '5']),
    ],
    [/title exceeds 55/, (value) => (value.google.lifetime.title = 't'.repeat(56))],
    [/description exceeds 200/, (value) => (value.google.lifetime.description = 'd'.repeat(201))],
  ]
  for (const [message, mutate] of invalidValues) {
    withTempDirectory((directory) => {
      const value = validFile()
      mutate(value)
      writeFile(directory, 'en', value)
      assert.throws(() => loadStoreLocalizationsFromDirectory(directory), message)
    })
  }
})

test('Apple metadata payloads use the explicit Apple locale section', async () => {
  const config = structuredClone(monetizationConfig) as MonetizationConfig
  config.products.weekly.appleReviewScreenshotPath = undefined
  config.products.lifetime.appleReviewScreenshotPath = undefined
  const localization: StoreLocalization = {
    sourceLocale: 'test',
    appleLocale: 'en-US',
    googleLocale: 'en-US',
    apple: {
      subscriptionGroupDisplayName: 'Apple Group',
      products: {
        weekly: { displayName: 'Apple Weekly', description: 'Apple weekly description' },
        monthly: { displayName: 'Apple Monthly', description: 'Apple monthly description' },
        yearly: { displayName: 'Apple Yearly', description: 'Apple yearly description' },
        lifetime: { displayName: 'Apple Lifetime', description: 'Apple lifetime description' },
      },
    },
    google: {
      subscription: {
        title: 'Google Subscription',
        description: 'Google subscription description',
        benefits: ['Google benefit'],
      },
      lifetime: { title: 'Google Lifetime', description: 'Google lifetime description' },
    },
  }
  const writes: Array<{ type: string; attributes: Record<string, string> }> = []
  const reconciler = new AppleMetadataReconciler(
    config,
    [localization],
    new Reporter('apply', { color: false }),
    async (_path, options) => {
      const body = options?.body as
        { data?: { type?: string; attributes?: Record<string, string> } } | undefined
      if (body?.data?.type && body.data.attributes) {
        writes.push({ type: body.data.type, attributes: body.data.attributes })
      }
      return undefined
    },
    async (path) =>
      path.includes('/localizations')
        ? []
        : [
            {
              id: 'version-1',
              type: 'version',
              attributes: { version: 1, state: 'PREPARE_FOR_SUBMISSION' },
            },
          ]
  )

  await reconciler.syncSubscription('weekly-id', 'weekly')
  await reconciler.syncLifetimePurchase('lifetime-id')
  assert.deepEqual(writes, [
    {
      type: 'subscriptionLocalizations',
      attributes: {
        name: 'Apple Weekly',
        description: 'Apple weekly description',
        locale: 'en-US',
      },
    },
    {
      type: 'inAppPurchaseLocalizations',
      attributes: {
        name: 'Apple Lifetime',
        description: 'Apple lifetime description',
        locale: 'en-US',
      },
    },
  ])
})

test('Google listing payloads use the explicit Google locale section', () => {
  const client = new GooglePlayClient(
    monetizationConfig,
    { packageName: 'com.example.app', jsonKeyPath: '/unused' },
    new Reporter('plan', { color: false }),
    async () => undefined
  ) as unknown as {
    subscriptionListings(): Array<{
      languageCode: string
      title: string
      description: string
      benefits: string[]
    }>
    lifetimeListings(): Array<{ languageCode: string; title: string; description: string }>
  }
  const subscription = client
    .subscriptionListings()
    .find((listing) => listing.languageCode === 'en-US')
  const lifetime = client.lifetimeListings().find((listing) => listing.languageCode === 'en-US')
  assert.deepEqual(subscription, {
    languageCode: 'en-US',
    title: 'Premium',
    description: 'Full access to all premium features.',
    benefits: ['Access all premium features'],
  })
  assert.deepEqual(lifetime, {
    languageCode: 'en-US',
    title: 'Premium · Lifetime',
    description: 'Lifetime access to all premium features.',
  })
})

test('RevenueCat product labels use non-localized reference names', () => {
  const config = structuredClone(monetizationConfig) as MonetizationConfig
  config.enabledProducts = ['weekly', 'lifetime']
  config.products.weekly.referenceName = 'Reference Weekly'
  config.products.lifetime.referenceName = 'Reference Lifetime'
  const client = new RevenueCatClient(
    config,
    {
      projectId: 'project',
      bundleIdentifier: 'com.example.app',
      packageName: 'com.example.app',
      apiKey: 'unused',
    },
    new Reporter('plan', { color: false })
  ) as unknown as {
    desiredProducts(apps: {
      appleAppId: string
      googleAppId: string
    }): Array<{ displayName: string }>
  }
  assert.deepEqual(
    client
      .desiredProducts({ appleAppId: 'apple', googleAppId: 'google' })
      .map((item) => item.displayName),
    [
      'Reference Weekly (App Store)',
      'Reference Weekly (Google Play)',
      'Reference Lifetime (App Store)',
      'Reference Lifetime (Google Play)',
    ]
  )
})
