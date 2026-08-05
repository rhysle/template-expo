import fs from 'node:fs'
import path from 'node:path'

import type {
  AppleProductLocalization,
  GoogleProductListing,
  ProductKey,
  StoreLocalization,
} from './types'

const ROOT = path.resolve(__dirname, '../..')
const LOCALIZATION_DIRECTORY = path.join(ROOT, 'fastlane/monetization/localizations')
const PRODUCT_KEYS: ProductKey[] = ['weekly', 'monthly', 'yearly', 'lifetime']

type JsonObject = Record<string, unknown>

const characterCount = (value: string): number => Array.from(value).length

const objectAt = (value: unknown, location: string): JsonObject => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${location} must be an object`)
  }
  return value as JsonObject
}

const exactObjectAt = (
  value: unknown,
  location: string,
  expectedKeys: readonly string[]
): JsonObject => {
  const object = objectAt(value, location)
  const actualKeys = Object.keys(object).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()
  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new Error(`${location} must contain exactly: ${sortedExpectedKeys.join(', ')}`)
  }
  return object
}

const stringAt = (value: unknown, location: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${location} must be a nonblank string`)
  }
  return value.trim()
}

const withinLimit = (value: string, location: string, maximum: number): string => {
  const length = characterCount(value)
  if (length > maximum) {
    throw new Error(`${location} exceeds ${maximum} characters`)
  }
  return value
}

const parseAppleProduct = (value: unknown, location: string): AppleProductLocalization => {
  const product = exactObjectAt(value, location, ['displayName', 'description'])
  const displayName = stringAt(product.displayName, `${location}.displayName`)
  const nameLength = characterCount(displayName)
  if (nameLength < 2 || nameLength > 35) {
    throw new Error(`${location}.displayName must be 2-35 characters`)
  }
  return {
    displayName,
    description: withinLimit(
      stringAt(product.description, `${location}.description`),
      `${location}.description`,
      55
    ),
  }
}

const parseGoogleListing = (value: unknown, location: string): GoogleProductListing => {
  const listing = exactObjectAt(value, location, ['title', 'description'])
  return {
    title: withinLimit(stringAt(listing.title, `${location}.title`), `${location}.title`, 55),
    description: withinLimit(
      stringAt(listing.description, `${location}.description`),
      `${location}.description`,
      200
    ),
  }
}

const parseBenefits = (value: unknown, location: string): string[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    throw new Error(`${location} must contain 1-4 benefits`)
  }
  return value.map((benefit, index) =>
    withinLimit(stringAt(benefit, `${location}[${index}]`), `${location}[${index}]`, 40)
  )
}

const parseLocalization = (sourceLocale: string, value: unknown): StoreLocalization => {
  const root = exactObjectAt(value, sourceLocale, [
    'appleLocale',
    'googleLocale',
    'apple',
    'google',
  ])
  const apple = exactObjectAt(root.apple, `${sourceLocale}.apple`, [
    'subscriptionGroupDisplayName',
    'products',
  ])
  const products = exactObjectAt(apple.products, `${sourceLocale}.apple.products`, PRODUCT_KEYS)
  const google = exactObjectAt(root.google, `${sourceLocale}.google`, ['subscription', 'lifetime'])
  const subscription = exactObjectAt(google.subscription, `${sourceLocale}.google.subscription`, [
    'title',
    'description',
    'benefits',
  ])

  return {
    sourceLocale,
    appleLocale: stringAt(root.appleLocale, `${sourceLocale}.appleLocale`),
    googleLocale: stringAt(root.googleLocale, `${sourceLocale}.googleLocale`),
    apple: {
      subscriptionGroupDisplayName: stringAt(
        apple.subscriptionGroupDisplayName,
        `${sourceLocale}.apple.subscriptionGroupDisplayName`
      ),
      products: Object.fromEntries(
        PRODUCT_KEYS.map((key) => [
          key,
          parseAppleProduct(products[key], `${sourceLocale}.apple.products.${key}`),
        ])
      ) as Record<ProductKey, AppleProductLocalization>,
    },
    google: {
      subscription: {
        title: withinLimit(
          stringAt(subscription.title, `${sourceLocale}.google.subscription.title`),
          `${sourceLocale}.google.subscription.title`,
          55
        ),
        description: withinLimit(
          stringAt(subscription.description, `${sourceLocale}.google.subscription.description`),
          `${sourceLocale}.google.subscription.description`,
          200
        ),
        benefits: parseBenefits(
          subscription.benefits,
          `${sourceLocale}.google.subscription.benefits`
        ),
      },
      lifetime: parseGoogleListing(google.lifetime, `${sourceLocale}.google.lifetime`),
    },
  }
}

const readLocalization = (directory: string, sourceLocale: string): StoreLocalization => {
  const filePath = path.join(directory, `${sourceLocale}.json`)
  let value: unknown
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to read monetization localization ${filePath}: ${message}`)
  }
  return parseLocalization(sourceLocale, value)
}

export const loadStoreLocalizationsFromDirectory = (directory: string): StoreLocalization[] => {
  if (!fs.existsSync(directory)) {
    throw new Error(`Monetization localization directory not found: ${directory}`)
  }
  const sourceLocales = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -'.json'.length))
    .sort((left, right) => left.localeCompare(right))
  if (sourceLocales.length === 0) {
    throw new Error(`No monetization localization JSON files found in ${directory}`)
  }

  const localizations = sourceLocales.map((sourceLocale) =>
    readLocalization(directory, sourceLocale)
  )
  const duplicateApple = localizations.find(
    (item, index) =>
      localizations.findIndex((candidate) => candidate.appleLocale === item.appleLocale) !== index
  )
  const duplicateGoogle = localizations.find(
    (item, index) =>
      localizations.findIndex((candidate) => candidate.googleLocale === item.googleLocale) !== index
  )
  if (duplicateApple) throw new Error(`Duplicate Apple locale ${duplicateApple.appleLocale}`)
  if (duplicateGoogle) throw new Error(`Duplicate Google locale ${duplicateGoogle.googleLocale}`)
  return localizations
}

let cachedLocalizations: StoreLocalization[] | undefined

export const loadStoreLocalizations = (): StoreLocalization[] => {
  cachedLocalizations ??= loadStoreLocalizationsFromDirectory(LOCALIZATION_DIRECTORY)
  return cachedLocalizations
}
