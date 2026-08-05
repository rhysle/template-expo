import { GoogleAuth } from './auth'
import { enabledSubscriptionKeys, isEnabled } from './config'
import { appendQuery, requestJson } from './http'
import { loadStoreLocalizations } from './localizations'
import { Reporter } from './reporter'
import type {
  GoogleConvertedPrices,
  GoogleMoney,
  MonetizationConfig,
  StoreLocalization,
  StoreEnvironment,
  SubscriptionProductKey,
} from './types'

const API_ROOT = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications'

interface GoogleBasePlan {
  basePlanId: string
  state?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | string
  regionalConfigs: Array<{
    regionCode: string
    newSubscriberAvailability: boolean
    price: GoogleMoney
  }>
  otherRegionsConfig: {
    usdPrice: GoogleMoney
    eurPrice: GoogleMoney
  }
  autoRenewingBasePlanType: {
    billingPeriodDuration: string
  }
}

interface GoogleSubscription {
  packageName: string
  productId: string
  basePlans: GoogleBasePlan[]
  listings: Array<{
    languageCode: string
    title: string
    benefits: string[]
    description: string
  }>
}

interface GooglePurchaseOption {
  purchaseOptionId: string
  state?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | string
  regionalPricingAndAvailabilityConfigs: Array<{
    regionCode: string
    price: GoogleMoney
    availability: 'AVAILABLE'
  }>
  newRegionsConfig: {
    usdPrice: GoogleMoney
    eurPrice: GoogleMoney
    availability: 'AVAILABLE'
  }
  buyOption: {
    legacyCompatible: boolean
    multiQuantityEnabled: boolean
  }
}

interface GoogleOneTimeProduct {
  packageName: string
  productId: string
  listings: Array<{ languageCode: string; title: string; description: string }>
  purchaseOptions: GooglePurchaseOption[]
}

const BILLING_PERIOD: Record<SubscriptionProductKey, string> = {
  weekly: 'P1W',
  monthly: 'P1M',
  yearly: 'P1Y',
}

const decimalToMoney = (value: string): GoogleMoney => {
  const [units, fraction] = value.split('.')
  return {
    currencyCode: 'USD',
    units,
    nanos: Number(fraction.padEnd(9, '0')),
  }
}

const moneyToDecimal = (money: GoogleMoney): string => {
  const units = BigInt(money.units || '0')
  const nanos = BigInt(money.nanos || 0)
  const cents = units * 100n + nanos / 10_000_000n
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

const withoutState = (basePlan: GoogleBasePlan): GoogleBasePlan => {
  const { state: _state, ...rest } = basePlan
  return rest
}

interface ComparableListing {
  languageCode: string
  title: string
  description: string
  benefits?: string[]
}

const normalizedListings = (listings: ComparableListing[]): ComparableListing[] =>
  listings
    .map((listing) => ({
      languageCode: listing.languageCode,
      title: listing.title,
      description: listing.description ?? '',
      ...(listing.benefits === undefined ? {} : { benefits: [...listing.benefits] }),
    }))
    .sort((left, right) => left.languageCode.localeCompare(right.languageCode))

const listingsEqual = (left: ComparableListing[], right: ComparableListing[]): boolean =>
  JSON.stringify(normalizedListings(left)) === JSON.stringify(normalizedListings(right))

export class GooglePlayClient {
  private readonly auth: GoogleAuth
  private readonly localizations: StoreLocalization[]
  private readonly convertedPriceCache = new Map<string, GoogleConvertedPrices>()

  constructor(
    private readonly config: MonetizationConfig,
    private readonly environment: NonNullable<StoreEnvironment['google']>,
    private readonly reporter: Reporter
  ) {
    this.auth = new GoogleAuth(environment.jsonKeyPath)
    this.localizations = loadStoreLocalizations(config)
  }

  private async request<T>(
    pathOrUrl: string,
    options: Parameters<typeof requestJson<T>>[1] = {}
  ): Promise<T | undefined> {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}${pathOrUrl}`
    return requestJson<T>(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${await this.auth.getToken()}`,
        ...options.headers,
      },
    })
  }

  async sync(): Promise<void> {
    this.reporter.section('Google Play')
    await this.syncSubscription()
    await this.syncLifetimePurchase()
  }

  async activate(): Promise<void> {
    this.reporter.section('Google Play activation')
    await this.activateSubscriptions()
    await this.activateLifetimePurchase()
  }

  private async convertPrice(priceUsd: string): Promise<GoogleConvertedPrices> {
    const cached = this.convertedPriceCache.get(priceUsd)
    if (cached) return cached
    const result = await this.request<GoogleConvertedPrices>('/pricing:convertRegionPrices', {
      method: 'POST',
      body: { price: decimalToMoney(priceUsd) },
    })
    if (!result) throw new Error(`Google did not return converted prices for $${priceUsd}`)
    this.convertedPriceCache.set(priceUsd, result)
    return result
  }

  private buildBasePlan(
    key: SubscriptionProductKey,
    converted: GoogleConvertedPrices
  ): GoogleBasePlan {
    return {
      basePlanId: this.config.products[key].googleBasePlanId,
      regionalConfigs: Object.values(converted.convertedRegionPrices).map((item) => ({
        regionCode: item.regionCode,
        newSubscriberAvailability: true,
        price: item.price,
      })),
      otherRegionsConfig: {
        usdPrice: converted.convertedOtherRegionsPrice.usdPrice,
        eurPrice: converted.convertedOtherRegionsPrice.eurPrice,
      },
      autoRenewingBasePlanType: {
        billingPeriodDuration: BILLING_PERIOD[key],
      },
    }
  }

  private subscriptionListings(): GoogleSubscription['listings'] {
    return this.localizations.map((localization) => ({
      languageCode: localization.googleLocale,
      title: localization.subscriptionTitle,
      benefits: localization.subscriptionBenefits,
      description: localization.subscriptionDescription,
    }))
  }

  private lifetimeListings(): GoogleOneTimeProduct['listings'] {
    return this.localizations.map((localization) => ({
      languageCode: localization.googleLocale,
      title: localization.products.lifetime.displayName,
      description: localization.products.lifetime.description,
    }))
  }

  private async getSubscription(): Promise<GoogleSubscription | undefined> {
    return this.request<GoogleSubscription>(
      `/subscriptions/${encodeURIComponent(this.config.google.subscriptionProductId)}`,
      { allowNotFound: true }
    )
  }

  private async syncSubscription(): Promise<void> {
    const keys = enabledSubscriptionKeys()
    if (keys.length === 0) {
      this.reporter.info('No Google subscriptions enabled')
      return
    }

    let subscription = await this.getSubscription()
    if (!subscription) {
      if (this.reporter.command === 'apply') {
        const converted = await Promise.all(
          keys.map(
            async (key) =>
              [key, await this.convertPrice(this.config.products[key].priceUsd)] as const
          )
        )
        const regionsVersion = converted[0][1].regionVersion.version
        for (const [, prices] of converted) {
          if (prices.regionVersion.version !== regionsVersion) {
            throw new Error(
              'Google region versions changed while preparing subscription prices; retry'
            )
          }
        }
        const body: GoogleSubscription = {
          packageName: this.environment.packageName,
          productId: this.config.google.subscriptionProductId,
          basePlans: converted.map(([key, prices]) => this.buildBasePlan(key, prices)),
          listings: this.subscriptionListings(),
        }
        const url = appendQuery(
          `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/subscriptions`,
          {
            productId: this.config.google.subscriptionProductId,
            'regionsVersion.version': regionsVersion,
          }
        )
        subscription = await this.request<GoogleSubscription>(url, { method: 'POST', body })
        if (!subscription) throw new Error('Google did not return the created subscription')
        this.reporter.change(`created Google subscription with ${keys.length} draft base plan(s)`)
      } else if (this.reporter.command === 'verify') {
        this.reporter.error('Missing: Google subscription')
        return
      } else {
        this.reporter.change(
          `create Google subscription with ${keys.map((key) => `${key} base plan`).join(' and ')}`
        )
        return
      }
    } else {
      this.reporter.ok('Google subscription')
    }

    subscription = await this.syncSubscriptionListings(subscription, keys[0])

    for (const key of keys) {
      const desired = this.config.products[key]
      const existing = subscription.basePlans.find(
        (item) => item.basePlanId === desired.googleBasePlanId
      )
      if (existing) {
        this.reporter.ok(`Google ${key} base plan`)
        this.verifyGooglePrice(`Google ${key}`, existing.regionalConfigs, desired.priceUsd)
        continue
      }

      if (this.reporter.command === 'apply') {
        const converted = await this.convertPrice(desired.priceUsd)
        const newPlan = this.buildBasePlan(key, converted)
        const basePlans = [...subscription.basePlans.map(withoutState), newPlan]
        const url = appendQuery(
          `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/subscriptions/${encodeURIComponent(subscription.productId)}`,
          {
            updateMask: 'basePlans',
            'regionsVersion.version': converted.regionVersion.version,
          }
        )
        const updated = await this.request<GoogleSubscription>(url, {
          method: 'PATCH',
          body: {
            packageName: subscription.packageName,
            productId: subscription.productId,
            basePlans,
          },
        })
        if (!updated) throw new Error(`Google did not return the added ${key} base plan`)
        subscription = updated
        this.reporter.change(`created Google ${key} draft base plan`)
      } else if (this.reporter.command === 'verify') {
        this.reporter.error(`Missing: Google ${key} base plan`)
      } else {
        this.reporter.change(`create Google ${key} draft base plan`)
      }
    }
  }

  private async syncSubscriptionListings(
    subscription: GoogleSubscription,
    pricingKey: SubscriptionProductKey
  ): Promise<GoogleSubscription> {
    const desiredListings = this.subscriptionListings()
    if (listingsEqual(subscription.listings, desiredListings)) {
      this.reporter.ok(`Google subscription localizations (${desiredListings.length})`)
      return subscription
    }

    if (this.reporter.command === 'verify') {
      this.reporter.error('Google subscription localizations differ from config')
      return subscription
    }
    if (this.reporter.command === 'plan') {
      this.reporter.change(`update ${desiredListings.length} Google subscription localizations`)
      return subscription
    }

    const converted = await this.convertPrice(this.config.products[pricingKey].priceUsd)
    const url = appendQuery(
      `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/subscriptions/${encodeURIComponent(subscription.productId)}`,
      {
        updateMask: 'listings',
        'regionsVersion.version': converted.regionVersion.version,
      }
    )
    const updated = await this.request<GoogleSubscription>(url, {
      method: 'PATCH',
      body: {
        packageName: subscription.packageName,
        productId: subscription.productId,
        listings: desiredListings,
      },
    })
    if (!updated) throw new Error('Google did not return the updated subscription listings')
    this.reporter.change(`updated ${desiredListings.length} Google subscription localizations`)
    return updated
  }

  private verifyGooglePrice(
    label: string,
    regionalConfigs: Array<{ regionCode: string; price: GoogleMoney }>,
    desiredUsd: string
  ): void {
    const usPrice = regionalConfigs.find((item) => item.regionCode === 'US')?.price
    if (!usPrice) {
      this.reporter.error(`${label} has no US regional price`)
    } else if (moneyToDecimal(usPrice) !== desiredUsd) {
      this.reporter.error(
        `${label} already has US price $${moneyToDecimal(usPrice)}; initial setup will not change it to $${desiredUsd}`
      )
    } else {
      this.reporter.ok(`${label} US price is $${desiredUsd}`)
    }
  }

  private async getLifetimePurchase(): Promise<GoogleOneTimeProduct | undefined> {
    return this.request<GoogleOneTimeProduct>(
      `/oneTimeProducts/${encodeURIComponent(this.config.products.lifetime.googleProductId)}`,
      { allowNotFound: true }
    )
  }

  private async syncLifetimePurchase(): Promise<void> {
    if (!isEnabled('lifetime')) {
      this.reporter.info('No Google lifetime purchase enabled')
      return
    }

    const desired = this.config.products.lifetime
    let purchase = await this.getLifetimePurchase()
    if (!purchase) {
      if (this.reporter.command === 'apply') {
        const converted = await this.convertPrice(desired.priceUsd)
        const body: GoogleOneTimeProduct = {
          packageName: this.environment.packageName,
          productId: desired.googleProductId,
          listings: this.lifetimeListings(),
          purchaseOptions: [
            {
              purchaseOptionId: desired.googlePurchaseOptionId,
              regionalPricingAndAvailabilityConfigs: Object.values(
                converted.convertedRegionPrices
              ).map((item) => ({
                regionCode: item.regionCode,
                price: item.price,
                availability: 'AVAILABLE',
              })),
              newRegionsConfig: {
                usdPrice: converted.convertedOtherRegionsPrice.usdPrice,
                eurPrice: converted.convertedOtherRegionsPrice.eurPrice,
                availability: 'AVAILABLE',
              },
              buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
            },
          ],
        }
        const url = appendQuery(
          `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/onetimeproducts/${encodeURIComponent(desired.googleProductId)}`,
          {
            allowMissing: true,
            updateMask: 'listings,purchaseOptions',
            'regionsVersion.version': converted.regionVersion.version,
          }
        )
        purchase = await this.request<GoogleOneTimeProduct>(url, { method: 'PATCH', body })
        if (!purchase) throw new Error('Google did not return the created lifetime purchase')
        this.reporter.change('created Google lifetime draft purchase option')
      } else if (this.reporter.command === 'verify') {
        this.reporter.error('Missing: Google lifetime purchase')
        return
      } else {
        this.reporter.change('create Google lifetime draft purchase option')
        return
      }
    } else {
      this.reporter.ok('Google lifetime product')
    }

    purchase = await this.syncLifetimeListings(purchase)

    const option = purchase.purchaseOptions.find(
      (item) => item.purchaseOptionId === desired.googlePurchaseOptionId
    )
    if (!option) {
      this.reporter.error(
        `Google lifetime product exists without purchase option ${desired.googlePurchaseOptionId}; initial setup will not replace its purchase options`
      )
      return
    }
    this.reporter.ok('Google lifetime purchase option')
    this.verifyGooglePrice(
      'Google lifetime',
      option.regionalPricingAndAvailabilityConfigs,
      desired.priceUsd
    )
  }

  private async syncLifetimeListings(
    purchase: GoogleOneTimeProduct
  ): Promise<GoogleOneTimeProduct> {
    const desiredListings = this.lifetimeListings()
    if (listingsEqual(purchase.listings, desiredListings)) {
      this.reporter.ok(`Google lifetime localizations (${desiredListings.length})`)
      return purchase
    }

    if (this.reporter.command === 'verify') {
      this.reporter.error('Google lifetime localizations differ from config')
      return purchase
    }
    if (this.reporter.command === 'plan') {
      this.reporter.change(`update ${desiredListings.length} Google lifetime localizations`)
      return purchase
    }

    const converted = await this.convertPrice(this.config.products.lifetime.priceUsd)
    const url = appendQuery(
      `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/onetimeproducts/${encodeURIComponent(purchase.productId)}`,
      {
        updateMask: 'listings',
        'regionsVersion.version': converted.regionVersion.version,
      }
    )
    const updated = await this.request<GoogleOneTimeProduct>(url, {
      method: 'PATCH',
      body: {
        packageName: purchase.packageName,
        productId: purchase.productId,
        listings: desiredListings,
      },
    })
    if (!updated) throw new Error('Google did not return the updated lifetime listings')
    this.reporter.change(`updated ${desiredListings.length} Google lifetime localizations`)
    return updated
  }

  private async activateSubscriptions(): Promise<void> {
    const keys = enabledSubscriptionKeys()
    if (keys.length === 0) return
    const subscription = await this.getSubscription()
    if (!subscription) {
      this.reporter.error('Google subscription is missing; run monetization:apply first')
      return
    }

    for (const key of keys) {
      const id = this.config.products[key].googleBasePlanId
      const plan = subscription.basePlans.find((item) => item.basePlanId === id)
      if (!plan) {
        this.reporter.error(`Google ${key} base plan is missing; run monetization:apply first`)
      } else if (plan.state === 'ACTIVE') {
        this.reporter.ok(`Google ${key} base plan already active`)
      } else if (plan.state !== 'DRAFT') {
        this.reporter.error(`Google ${key} base plan is ${plan.state}; only drafts are activated`)
      } else {
        await this.request(
          `/subscriptions/${encodeURIComponent(subscription.productId)}/basePlans/${encodeURIComponent(id)}:activate`,
          { method: 'POST', body: {} }
        )
        this.reporter.change(`activated Google ${key} base plan`)
      }
    }
  }

  private async activateLifetimePurchase(): Promise<void> {
    if (!isEnabled('lifetime')) return
    const desired = this.config.products.lifetime
    const purchase = await this.getLifetimePurchase()
    const option = purchase?.purchaseOptions.find(
      (item) => item.purchaseOptionId === desired.googlePurchaseOptionId
    )
    if (!option) {
      this.reporter.error(
        'Google lifetime purchase option is missing; run monetization:apply first'
      )
    } else if (option.state === 'ACTIVE') {
      this.reporter.ok('Google lifetime purchase option already active')
    } else if (option.state !== 'DRAFT') {
      this.reporter.error(
        `Google lifetime purchase option is ${option.state}; only drafts are activated`
      )
    } else {
      await this.request(
        `/oneTimeProducts/${encodeURIComponent(desired.googleProductId)}/purchaseOptions:batchUpdateStates`,
        {
          method: 'POST',
          body: {
            requests: [
              {
                activatePurchaseOptionRequest: {
                  packageName: this.environment.packageName,
                  productId: desired.googleProductId,
                  purchaseOptionId: desired.googlePurchaseOptionId,
                },
              },
            ],
          },
        }
      )
      this.reporter.change('activated Google lifetime purchase option')
    }
  }
}
