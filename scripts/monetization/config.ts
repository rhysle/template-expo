import fs from 'node:fs'
import path from 'node:path'

import { monetizationConfig } from '../../src/configs/monetization'

import type { MonetizationConfig, ProductKey, SubscriptionProductKey } from './types'

const PRODUCT_KEYS: ProductKey[] = ['weekly', 'monthly', 'yearly', 'lifetime']
const SUBSCRIPTION_KEYS: SubscriptionProductKey[] = ['weekly', 'monthly', 'yearly']
const MONEY_PATTERN = /^\d+\.\d{2}$/
const APPLE_PRODUCT_ID_PATTERN = /^[A-Za-z0-9._-]+$/
const GOOGLE_PRODUCT_ID_PATTERN = /^[a-z0-9][a-z0-9._]{0,39}$/
const GOOGLE_PLAN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/
const ROOT = path.resolve(__dirname, '../..')

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`Invalid src/configs/monetization.ts: ${message}`)
}

export const validateConfig = (config: MonetizationConfig): void => {
  assert(config.enabledProducts.length > 0, 'enabledProducts must contain at least one product')
  assert(
    new Set(config.enabledProducts).size === config.enabledProducts.length,
    'enabledProducts must not contain duplicates'
  )

  for (const key of config.enabledProducts) {
    assert(PRODUCT_KEYS.includes(key), `unknown enabled product: ${key}`)
    const product = config.products[key]
    assert(MONEY_PATTERN.test(product.priceUsd), `${key}.priceUsd must look like "3.99"`)
    assert(product.referenceName.trim().length > 0, `${key}.referenceName is required`)
    assert(product.displayName.trim().length > 0, `${key}.displayName is required`)
    assert(product.description.trim().length > 0, `${key}.description is required`)
    if (product.appleReviewScreenshotPath) {
      const screenshotPath = path.isAbsolute(product.appleReviewScreenshotPath)
        ? product.appleReviewScreenshotPath
        : path.resolve(ROOT, product.appleReviewScreenshotPath)
      assert(fs.existsSync(screenshotPath), `${key}.appleReviewScreenshotPath does not exist`)
      assert(
        ['.png', '.jpg', '.jpeg'].includes(path.extname(screenshotPath).toLowerCase()),
        `${key}.appleReviewScreenshotPath must be PNG or JPEG`
      )
    }
    assert(
      APPLE_PRODUCT_ID_PATTERN.test(product.appleProductId),
      `${key}.appleProductId contains unsupported characters`
    )
  }

  assert(
    config.localization.sourceDirectory.trim().length > 0,
    'localization.sourceDirectory is required'
  )
  assert(
    config.localization.sourceLocale.trim().length > 0,
    'localization.sourceLocale is required'
  )

  for (const key of SUBSCRIPTION_KEYS) {
    const product = config.products[key]
    assert(
      GOOGLE_PLAN_ID_PATTERN.test(product.googleBasePlanId),
      `${key}.googleBasePlanId must be a lowercase RFC-1034 identifier`
    )
  }

  assert(
    GOOGLE_PRODUCT_ID_PATTERN.test(config.products.lifetime.googleProductId),
    'lifetime.googleProductId must be a valid Google product ID'
  )
  assert(
    GOOGLE_PLAN_ID_PATTERN.test(config.products.lifetime.googlePurchaseOptionId),
    'lifetime.googlePurchaseOptionId must be a valid Google purchase-option ID'
  )
  assert(
    GOOGLE_PRODUCT_ID_PATTERN.test(config.google.subscriptionProductId),
    'google.subscriptionProductId must be a valid Google product ID'
  )
  assert(
    /^[A-Z]{3}$/.test(config.apple.baseTerritory),
    'apple.baseTerritory must be a three-letter App Store territory ID such as USA'
  )
  assert(config.apple.locale.trim().length > 0, 'apple.locale is required')
  assert(config.google.locale.trim().length > 0, 'google.locale is required')
}

validateConfig(monetizationConfig)

export const config: MonetizationConfig = monetizationConfig

export const enabledSubscriptionKeys = (): SubscriptionProductKey[] =>
  SUBSCRIPTION_KEYS.filter((key) => config.enabledProducts.includes(key))

export const isEnabled = (key: ProductKey): boolean => config.enabledProducts.includes(key)
