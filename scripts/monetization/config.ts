import fs from 'node:fs'
import path from 'node:path'

import { monetizationConfig } from '../../src/configs/monetization'
import { FREE_TRIAL_DURATIONS } from './free-trial'

import type { MonetizationConfig, ProductKey, SubscriptionProductKey } from './types'

const PRODUCT_KEYS: ProductKey[] = ['weekly', 'monthly', 'yearly', 'lifetime']
const SUBSCRIPTION_KEYS: SubscriptionProductKey[] = ['weekly', 'monthly', 'yearly']
const MONEY_PATTERN = /^\d+\.\d{2}$/
const APPLE_PRODUCT_ID_PATTERN = /^[A-Za-z0-9._-]+$/
const GOOGLE_PRODUCT_ID_PATTERN = /^[a-z0-9][a-z0-9._]{0,39}$/
const GOOGLE_PLAN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/
const ISO_ALPHA_2_PATTERN = /^[A-Z]{2}$/
const PPP_BANDS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2]
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

  if (config.regionalPricing.strategy === 'ppp-bands') {
    assert(config.apple.baseTerritory === 'USA', 'PPP pricing requires apple.baseTerritory USA')
    assert(config.regionalPricing.dataset.trim().length > 0, 'regionalPricing.dataset is required')
    assert(config.regionalPricing.bands.length > 0, 'regionalPricing.bands must not be empty')
    const bands = [...config.regionalPricing.bands]
    assert(
      new Set(bands).size === bands.length,
      'regionalPricing.bands must not contain duplicates'
    )
    assert(
      bands.every((band) => Number.isFinite(band) && band > 0 && Number.isInteger(band * 10)),
      'regionalPricing.bands must be positive one-decimal numbers'
    )
    assert(
      bands.every((band, index) => index === 0 || band > bands[index - 1]),
      'regionalPricing.bands must be sorted ascending'
    )
    assert(bands.includes(1), 'regionalPricing.bands must include 1.0')
    assert(
      JSON.stringify(bands) === JSON.stringify(PPP_BANDS),
      `regionalPricing.bands must contain the complete ${PPP_BANDS.join(', ')} range`
    )
    for (const [country, band] of Object.entries(config.regionalPricing.countryOverrides)) {
      assert(
        ISO_ALPHA_2_PATTERN.test(country),
        `regionalPricing override ${country} must be ISO alpha-2`
      )
      assert(bands.includes(band), `regionalPricing override ${country} must use a configured band`)
    }
    assert(
      config.regionalPricing.countryOverrides.US === undefined ||
        config.regionalPricing.countryOverrides.US === 1,
      'regionalPricing override US must be 1.0'
    )
  }

  if (config.freeTrial) {
    assert(
      SUBSCRIPTION_KEYS.includes(config.freeTrial.target),
      'freeTrial.target must be weekly, monthly, or yearly'
    )
    assert(
      config.enabledProducts.includes(config.freeTrial.target),
      `freeTrial.target ${config.freeTrial.target} must be enabled`
    )
    assert(
      FREE_TRIAL_DURATIONS.includes(config.freeTrial.duration),
      `freeTrial.duration must be one of: ${FREE_TRIAL_DURATIONS.join(', ')}`
    )
  }

  for (const key of config.enabledProducts) {
    assert(PRODUCT_KEYS.includes(key), `unknown enabled product: ${key}`)
    const product = config.products[key]
    assert(MONEY_PATTERN.test(product.priceUsd), `${key}.priceUsd must look like "3.99"`)
    assert(product.referenceName.trim().length > 0, `${key}.referenceName is required`)
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
    GOOGLE_PLAN_ID_PATTERN.test(config.google.freeTrialOfferId),
    'google.freeTrialOfferId must be a lowercase RFC-1034 identifier'
  )
  assert(
    /^[A-Z]{3}$/.test(config.apple.baseTerritory),
    'apple.baseTerritory must be a three-letter App Store territory ID such as USA'
  )
}

validateConfig(monetizationConfig)

export const config: MonetizationConfig = monetizationConfig

export const enabledSubscriptionKeys = (
  value: MonetizationConfig = config
): SubscriptionProductKey[] =>
  SUBSCRIPTION_KEYS.filter((key) => value.enabledProducts.includes(key))

export const isEnabled = (key: ProductKey, value: MonetizationConfig = config): boolean =>
  value.enabledProducts.includes(key)
