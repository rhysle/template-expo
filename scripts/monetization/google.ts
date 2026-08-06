import { GoogleAuth } from './auth'
import { enabledSubscriptionKeys, isEnabled } from './config'
import { GOOGLE_FREE_TRIAL_DURATION } from './free-trial'
import { appendQuery, requestJson } from './http'
import type { JsonRequester } from './http'
import { loadStoreLocalizations } from './localizations'
import {
  adjustedPriceUsd,
  formatMoney,
  moneyEquals,
  moneyToNanos,
  RegionalPricingResolver,
  validateMoneyPrecision,
} from './ppp'
import { Reporter } from './reporter'
import type {
  GoogleConvertedPrices,
  GoogleMoney,
  MonetizationConfig,
  RegionalPricingAssignment,
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
    newSubscriberAvailability?: boolean
  }
  autoRenewingBasePlanType?: {
    billingPeriodDuration: string
  }
}

interface GoogleSubscriptionOfferPhase {
  recurrenceCount: number
  duration: string
  regionalConfigs: Array<{
    regionCode: string
    free?: Record<string, never>
  }>
  otherRegionsConfig?: {
    free?: Record<string, never>
  }
}

interface GoogleSubscriptionOffer {
  packageName: string
  productId: string
  basePlanId: string
  offerId: string
  state?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | string
  phases: GoogleSubscriptionOfferPhase[]
  targeting: {
    acquisitionRule?: {
      scope: {
        anySubscriptionInApp?: Record<string, never>
        thisSubscription?: Record<string, never>
      }
    }
    upgradeRule?: unknown
  }
  regionalConfigs: Array<{
    regionCode: string
    newSubscriberAvailability: boolean
  }>
  otherRegionsConfig: {
    otherRegionsNewSubscriberAvailability: boolean
  }
  offerTags: Array<{ tag: string }>
}

interface GoogleSubscriptionOfferList {
  subscriptionOffers?: GoogleSubscriptionOffer[]
  nextPageToken?: string
}

interface GoogleOfferWithPlan {
  plan: GoogleBasePlan
  offer: GoogleSubscriptionOffer
}

type GoogleFreeTrialDifference =
  'duration' | 'eligibility' | 'regional availability' | 'future-region availability'

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

interface GoogleRegionalPriceMatrix {
  regionalConfigs: Array<{ regionCode: string; price: GoogleMoney }>
  otherRegions: GoogleConvertedPrices['convertedOtherRegionsPrice']
  regionVersion: { version: string }
  fallbackRegions: string[]
  olderSourceYearRegions: string[]
  assignments: Map<string, RegionalPricingAssignment>
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
  private readonly auth: GoogleAuth | undefined
  private readonly localizations: StoreLocalization[]
  private readonly convertedPriceCache = new Map<string, GoogleConvertedPrices>()
  private readonly regionalPricing: RegionalPricingResolver

  constructor(
    private readonly config: MonetizationConfig,
    private readonly environment: NonNullable<StoreEnvironment['google']>,
    private readonly reporter: Reporter,
    private readonly requestOverride?: JsonRequester
  ) {
    this.auth = requestOverride ? undefined : new GoogleAuth(environment.jsonKeyPath)
    this.localizations = loadStoreLocalizations()
    this.regionalPricing = new RegionalPricingResolver(config)
  }

  private async request<T>(
    pathOrUrl: string,
    options: Parameters<typeof requestJson<T>>[1] = {}
  ): Promise<T | undefined> {
    if (this.requestOverride) return this.requestOverride<T>(pathOrUrl, options)
    if (!this.auth) throw new Error('Google authentication is unavailable')
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
    await this.activateFreeTrial()
    await this.activateLifetimePurchase()
  }

  async syncPrices(): Promise<void> {
    this.reporter.section('Google Play regional prices')
    await this.reconcileSubscriptionPrices()
    await this.reconcileLifetimePrices()
  }

  private priceDifferences(
    currentConfigs: Array<{ regionCode: string; price: GoogleMoney; available: boolean }>,
    desiredConfigs: Array<{ regionCode: string; price: GoogleMoney }>
  ): {
    changed: string[]
    increased: string[]
    decreased: string[]
  } {
    const current = new Map(currentConfigs.map((item) => [item.regionCode, item]))
    const desiredRegions = new Set(desiredConfigs.map((item) => item.regionCode))
    const changed: string[] = []
    const increased: string[] = []
    const decreased: string[] = []
    for (const desired of desiredConfigs) {
      const existing = current.get(desired.regionCode)
      if (!existing) {
        changed.push(desired.regionCode)
        continue
      }
      if (moneyEquals(existing.price, desired.price) && existing.available) continue
      changed.push(desired.regionCode)
      if (moneyEquals(existing.price, desired.price)) continue
      if (existing.price.currencyCode !== desired.price.currencyCode) continue
      const direction = moneyToNanos(desired.price) - moneyToNanos(existing.price)
      if (direction > 0n) increased.push(desired.regionCode)
      if (direction < 0n) decreased.push(desired.regionCode)
    }
    for (const existing of currentConfigs) {
      if (!desiredRegions.has(existing.regionCode)) changed.push(existing.regionCode)
    }
    return { changed, increased, decreased }
  }

  private validateBasePlanPeriod(plan: GoogleBasePlan, key: SubscriptionProductKey): boolean {
    const expected = BILLING_PERIOD[key]
    const actual = plan.autoRenewingBasePlanType?.billingPeriodDuration
    if (actual === expected) return true
    this.reporter.error(
      `Google ${key} base plan ${plan.basePlanId} has billing period ${actual ?? 'non-renewing/unknown'}; expected ${expected}. Configure a new googleBasePlanId because billing periods are immutable.`
    )
    return false
  }

  private async reconcileSubscriptionPrices(): Promise<void> {
    const keys = enabledSubscriptionKeys(this.config)
    if (keys.length === 0) return
    let subscription = await this.getSubscription()
    if (!subscription) {
      this.reporter.error('Missing: Google subscription; run monetization:apply first')
      return
    }
    for (const key of keys) {
      const desired = this.config.products[key]
      const plan = subscription.basePlans.find(
        (item) => item.basePlanId === desired.googleBasePlanId
      )
      if (!plan) {
        this.reporter.error(`Missing: Google ${key} base plan; run monetization:apply first`)
        continue
      }
      if (!this.validateBasePlanPeriod(plan, key)) continue
      const matrix = await this.prepareRegionalPriceMatrix(desired.priceUsd)
      this.reportPppCoverage(`Google ${key}`, matrix)
      const differences = this.priceDifferences(
        plan.regionalConfigs.map((item) => ({
          ...item,
          available: item.newSubscriberAvailability === true,
        })),
        matrix.regionalConfigs
      )
      const otherRegionsDiffer =
        !moneyEquals(plan.otherRegionsConfig.usdPrice, matrix.otherRegions.usdPrice) ||
        !moneyEquals(plan.otherRegionsConfig.eurPrice, matrix.otherRegions.eurPrice) ||
        plan.otherRegionsConfig.newSubscriberAvailability !== true
      if (differences.changed.length === 0 && !otherRegionsDiffer) {
        this.reporter.ok(`Google ${key} prices match ${matrix.regionalConfigs.length} region(s)`)
        continue
      }
      const sampleRegion = differences.changed[0]
      const oldPrice = sampleRegion
        ? plan.regionalConfigs.find((item) => item.regionCode === sampleRegion)?.price
        : undefined
      const newPrice = sampleRegion
        ? matrix.regionalConfigs.find((item) => item.regionCode === sampleRegion)?.price
        : undefined
      const assignment = sampleRegion ? matrix.assignments.get(sampleRegion) : undefined
      const pricingDetails = assignment
        ? `band ${assignment.multiplier}, anchor $${adjustedPriceUsd(desired.priceUsd, assignment.multiplier)}, ` +
          `${assignment.rawRatio === undefined ? 'ratio unavailable' : `ratio ${assignment.rawRatio.toFixed(3)}`}, ` +
          `${assignment.sourceYear === undefined ? 'no source year' : `source ${assignment.sourceYear}`}, ` +
          `${assignment.fallback ? '1.0 fallback' : assignment.overridden ? 'override' : 'automatic'}`
        : ''
      const summary =
        `update Google ${key} in ${differences.changed.length + (otherRegionsDiffer ? 1 : 0)} region group(s) ` +
        `(${differences.increased.length} increase, ${differences.decreased.length} decrease; ` +
        `${sampleRegion ? `${sampleRegion}: ${oldPrice ? formatMoney(oldPrice) : 'missing'} → ${newPrice ? formatMoney(newPrice) : 'missing'}; ${pricingDetails}` : 'future-region prices changed'}). ` +
        'Increases retain legacy cohorts; decreases migrate legacy cohorts.'
      if (this.reporter.command === 'prices-verify') {
        this.reporter.error(summary)
        continue
      }
      if (this.reporter.command === 'prices-plan') {
        this.reporter.change(summary)
        const currentByRegion = new Map(
          plan.regionalConfigs.map((item) => [item.regionCode, item.price])
        )
        for (const regionCode of differences.changed) {
          const existing = currentByRegion.get(regionCode)
          const target = matrix.regionalConfigs.find((item) => item.regionCode === regionCode)
          const itemAssignment = matrix.assignments.get(regionCode)
          if (!target || !itemAssignment) continue
          this.reporter.info(
            `${regionCode}: ${existing ? formatMoney(existing) : 'missing'} → ${formatMoney(target.price)}; ` +
              `source ${itemAssignment.sourceYear ?? 'none'}, ratio ${itemAssignment.rawRatio?.toFixed(3) ?? 'unavailable'}, ` +
              `band ${itemAssignment.multiplier}, anchor $${adjustedPriceUsd(desired.priceUsd, itemAssignment.multiplier)}, ` +
              `${itemAssignment.fallback ? '1.0 fallback' : itemAssignment.overridden ? 'override' : 'automatic'}, ` +
              `${differences.decreased.includes(regionCode) ? 'legacy cohorts migrate' : 'legacy cohorts retained'}`
          )
        }
        continue
      }

      const replacement = {
        ...withoutState(plan),
        ...this.buildBasePlan(key, matrix),
      }
      const migrationCutoff = new Date().toISOString()
      const basePlans = subscription.basePlans.map((item) =>
        item.basePlanId === plan.basePlanId ? replacement : withoutState(item)
      )
      const url = appendQuery(
        `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/subscriptions/${encodeURIComponent(subscription.productId)}`,
        {
          updateMask: 'basePlans',
          'regionsVersion.version': matrix.regionVersion.version,
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
      if (!updated) throw new Error(`Google did not return updated ${key} regional prices`)
      subscription = updated
      if (differences.decreased.length > 0) {
        await this.request(
          `/subscriptions/${encodeURIComponent(subscription.productId)}/basePlans/${encodeURIComponent(plan.basePlanId)}:migratePrices`,
          {
            method: 'POST',
            body: {
              regionalPriceMigrations: differences.decreased.map((regionCode) => ({
                regionCode,
                oldestAllowedPriceVersionTime: migrationCutoff,
              })),
              regionsVersion: matrix.regionVersion,
            },
          }
        )
      }
      this.reporter.change(summary)
    }
  }

  private async reconcileLifetimePrices(): Promise<void> {
    if (!isEnabled('lifetime', this.config)) return
    const desired = this.config.products.lifetime
    const purchase = await this.getLifetimePurchase()
    const option = purchase?.purchaseOptions.find(
      (item) => item.purchaseOptionId === desired.googlePurchaseOptionId
    )
    if (!purchase || !option) {
      this.reporter.error('Missing: Google lifetime purchase option; run monetization:apply first')
      return
    }
    const matrix = await this.prepareRegionalPriceMatrix(desired.priceUsd)
    this.reportPppCoverage('Google lifetime', matrix)
    const differences = this.priceDifferences(
      option.regionalPricingAndAvailabilityConfigs.map((item) => ({
        ...item,
        available: item.availability === 'AVAILABLE',
      })),
      matrix.regionalConfigs
    )
    const otherRegionsDiffer =
      !moneyEquals(option.newRegionsConfig.usdPrice, matrix.otherRegions.usdPrice) ||
      !moneyEquals(option.newRegionsConfig.eurPrice, matrix.otherRegions.eurPrice) ||
      option.newRegionsConfig.availability !== 'AVAILABLE'
    if (differences.changed.length === 0 && !otherRegionsDiffer) {
      this.reporter.ok(`Google lifetime prices match ${matrix.regionalConfigs.length} region(s)`)
      return
    }
    const summary = `update Google lifetime in ${differences.changed.length + (otherRegionsDiffer ? 1 : 0)} region group(s) (future purchases only)`
    if (this.reporter.command === 'prices-verify') {
      this.reporter.error(summary)
      return
    }
    if (this.reporter.command === 'prices-plan') {
      this.reporter.change(summary)
      const currentByRegion = new Map(
        option.regionalPricingAndAvailabilityConfigs.map((item) => [item.regionCode, item.price])
      )
      for (const regionCode of differences.changed) {
        const existing = currentByRegion.get(regionCode)
        const target = matrix.regionalConfigs.find((item) => item.regionCode === regionCode)
        const assignment = matrix.assignments.get(regionCode)
        if (!target || !assignment) continue
        this.reporter.info(
          `${regionCode}: ${existing ? formatMoney(existing) : 'missing'} → ${formatMoney(target.price)}; ` +
            `source ${assignment.sourceYear ?? 'none'}, ratio ${assignment.rawRatio?.toFixed(3) ?? 'unavailable'}, band ${assignment.multiplier}, ` +
            `anchor $${adjustedPriceUsd(desired.priceUsd, assignment.multiplier)}, ${assignment.fallback ? '1.0 fallback' : assignment.overridden ? 'override' : 'automatic'}, future purchases only`
        )
      }
      return
    }
    const replacement: GooglePurchaseOption = {
      ...option,
      regionalPricingAndAvailabilityConfigs: matrix.regionalConfigs.map((item) => ({
        ...item,
        availability: 'AVAILABLE',
      })),
      newRegionsConfig: {
        ...matrix.otherRegions,
        availability: 'AVAILABLE',
      },
    }
    const url = appendQuery(
      `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/onetimeproducts/${encodeURIComponent(purchase.productId)}`,
      {
        updateMask: 'purchaseOptions',
        'regionsVersion.version': matrix.regionVersion.version,
      }
    )
    await this.request<GoogleOneTimeProduct>(url, {
      method: 'PATCH',
      body: {
        packageName: purchase.packageName,
        productId: purchase.productId,
        purchaseOptions: purchase.purchaseOptions.map((item) =>
          item.purchaseOptionId === option.purchaseOptionId ? replacement : item
        ),
      },
    })
    this.reporter.change(summary)
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

  private async prepareRegionalPriceMatrix(priceUsd: string): Promise<GoogleRegionalPriceMatrix> {
    const baseline = await this.convertPrice(priceUsd)
    const baselineRegions = Object.values(baseline.convertedRegionPrices)
    const assignments = new Map(
      baselineRegions.map((item) => [
        item.regionCode,
        this.regionalPricing.forGoogle(item.regionCode),
      ])
    )
    const multipliers = this.regionalPricing.usedMultipliers(assignments.values())
    const convertedByMultiplier = new Map<number, GoogleConvertedPrices>()
    await Promise.all(
      multipliers.map(async (multiplier) => {
        const converted = await this.convertPrice(adjustedPriceUsd(priceUsd, multiplier))
        if (converted.regionVersion.version !== baseline.regionVersion.version) {
          throw new Error('Google region versions changed while preparing PPP prices; retry')
        }
        convertedByMultiplier.set(multiplier, converted)
      })
    )

    const regionalConfigs = baselineRegions.map((baselineRegion) => {
      const assignment = assignments.get(baselineRegion.regionCode)
      if (!assignment)
        throw new Error(`Missing Google pricing assignment ${baselineRegion.regionCode}`)
      const converted = convertedByMultiplier.get(assignment.multiplier)?.convertedRegionPrices[
        baselineRegion.regionCode
      ]
      if (!converted) {
        throw new Error(
          `Google did not return ${baselineRegion.regionCode} price for PPP band ${assignment.multiplier}`
        )
      }
      validateMoneyPrecision(converted.price)
      return { regionCode: baselineRegion.regionCode, price: converted.price }
    })

    const targetYear = this.regionalPricing.snapshot?.targetYear
    return {
      regionalConfigs,
      otherRegions: baseline.convertedOtherRegionsPrice,
      regionVersion: baseline.regionVersion,
      fallbackRegions: [...assignments]
        .filter(([, assignment]) => assignment.fallback)
        .map(([region]) => region),
      olderSourceYearRegions: [...assignments]
        .filter(([, assignment]) =>
          Boolean(targetYear && assignment.sourceYear && assignment.sourceYear < targetYear)
        )
        .map(([region]) => region),
      assignments,
    }
  }

  private reportPppCoverage(label: string, matrix: GoogleRegionalPriceMatrix): void {
    if (this.config.regionalPricing.strategy === 'store-equalized') return
    if (matrix.olderSourceYearRegions.length > 0) {
      this.reporter.info(
        `${label} PPP uses fallback source years in ${matrix.olderSourceYearRegions.length} region(s)`
      )
    }
    if (matrix.fallbackRegions.length > 0) {
      this.reporter.info(
        `${label} PPP uses 1.0 fallback in ${matrix.fallbackRegions.length} region(s): ${matrix.fallbackRegions.join(', ')}`
      )
    }
  }

  private buildBasePlan(
    key: SubscriptionProductKey,
    matrix: GoogleRegionalPriceMatrix
  ): GoogleBasePlan {
    return {
      basePlanId: this.config.products[key].googleBasePlanId,
      regionalConfigs: matrix.regionalConfigs.map((item) => ({
        regionCode: item.regionCode,
        newSubscriberAvailability: true,
        price: item.price,
      })),
      otherRegionsConfig: {
        usdPrice: matrix.otherRegions.usdPrice,
        eurPrice: matrix.otherRegions.eurPrice,
        newSubscriberAvailability: true,
      },
      autoRenewingBasePlanType: {
        billingPeriodDuration: BILLING_PERIOD[key],
      },
    }
  }

  private buildFreeTrialOffer(
    subscription: GoogleSubscription,
    plan: GoogleBasePlan
  ): GoogleSubscriptionOffer {
    const trial = this.config.freeTrial
    if (!trial) throw new Error('Cannot build a Google free trial when freeTrial is disabled')
    const regions = plan.regionalConfigs
      .filter((region) => region.newSubscriberAvailability)
      .map((region) => region.regionCode)
      .sort()
    const otherRegionsAvailable = plan.otherRegionsConfig.newSubscriberAvailability === true

    return {
      packageName: subscription.packageName,
      productId: subscription.productId,
      basePlanId: plan.basePlanId,
      offerId: this.config.google.freeTrialOfferId,
      phases: [
        {
          recurrenceCount: 1,
          duration: GOOGLE_FREE_TRIAL_DURATION[trial.duration],
          regionalConfigs: regions.map((regionCode) => ({ regionCode, free: {} })),
          ...(otherRegionsAvailable ? { otherRegionsConfig: { free: {} } } : {}),
        },
      ],
      targeting: {
        acquisitionRule: { scope: { anySubscriptionInApp: {} } },
      },
      regionalConfigs: regions.map((regionCode) => ({
        regionCode,
        newSubscriberAvailability: true,
      })),
      otherRegionsConfig: {
        otherRegionsNewSubscriberAvailability: otherRegionsAvailable,
      },
      offerTags: [],
    }
  }

  private freeTrialOfferDifferences(
    offer: GoogleSubscriptionOffer,
    subscription: GoogleSubscription,
    plan: GoogleBasePlan
  ): GoogleFreeTrialDifference[] {
    const desired = this.buildFreeTrialOffer(subscription, plan)
    const normalizeRegions = (
      regions: Array<{ regionCode: string; newSubscriberAvailability: boolean }>
    ): Array<{ regionCode: string; newSubscriberAvailability: boolean }> =>
      regions
        .map((region) => ({
          regionCode: region.regionCode,
          newSubscriberAvailability: region.newSubscriberAvailability,
        }))
        .sort((left, right) => left.regionCode.localeCompare(right.regionCode))
    const normalizePhaseRegions = (
      regions: GoogleSubscriptionOfferPhase['regionalConfigs']
    ): Array<{ regionCode: string; free: boolean }> =>
      regions
        .map((region) => ({ regionCode: region.regionCode, free: region.free !== undefined }))
        .sort((left, right) => left.regionCode.localeCompare(right.regionCode))

    const phase = offer.phases[0]
    const desiredPhase = desired.phases[0]
    const differences: GoogleFreeTrialDifference[] = []
    if (
      offer.phases.length !== 1 ||
      phase?.recurrenceCount !== desiredPhase.recurrenceCount ||
      phase.duration !== desiredPhase.duration
    ) {
      differences.push('duration')
    }
    if (
      offer.targeting.acquisitionRule?.scope.anySubscriptionInApp === undefined ||
      offer.targeting.upgradeRule !== undefined
    ) {
      differences.push('eligibility')
    }
    if (
      !phase ||
      JSON.stringify(normalizePhaseRegions(phase.regionalConfigs)) !==
        JSON.stringify(normalizePhaseRegions(desiredPhase.regionalConfigs)) ||
      JSON.stringify(normalizeRegions(offer.regionalConfigs)) !==
        JSON.stringify(normalizeRegions(desired.regionalConfigs))
    ) {
      differences.push('regional availability')
    }
    if (
      (phase?.otherRegionsConfig?.free !== undefined) !==
        (desiredPhase.otherRegionsConfig?.free !== undefined) ||
      offer.otherRegionsConfig.otherRegionsNewSubscriberAvailability !==
        desired.otherRegionsConfig.otherRegionsNewSubscriberAvailability
    ) {
      differences.push('future-region availability')
    }
    return differences
  }

  private isGoogleFreeOffer(offer: GoogleSubscriptionOffer): boolean {
    return offer.phases.some(
      (phase) =>
        phase.otherRegionsConfig?.free !== undefined ||
        phase.regionalConfigs.some((region) => region.free !== undefined)
    )
  }

  private async listGoogleOffers(subscription: GoogleSubscription): Promise<GoogleOfferWithPlan[]> {
    const results: GoogleOfferWithPlan[] = []
    for (const plan of subscription.basePlans) {
      let pageToken: string | undefined
      do {
        const url = appendQuery(
          `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/subscriptions/${encodeURIComponent(subscription.productId)}/basePlans/${encodeURIComponent(plan.basePlanId)}/offers`,
          { pageSize: 100, pageToken }
        )
        const response = await this.request<GoogleSubscriptionOfferList>(url)
        results.push(...(response?.subscriptionOffers ?? []).map((offer) => ({ plan, offer })))
        pageToken = response?.nextPageToken
      } while (pageToken)
    }
    return results
  }

  private unknownActiveFreeOffers(offers: GoogleOfferWithPlan[]): GoogleOfferWithPlan[] {
    const managedId = this.config.google.freeTrialOfferId
    return offers.filter(
      ({ offer }) =>
        offer.state === 'ACTIVE' && this.isGoogleFreeOffer(offer) && offer.offerId !== managedId
    )
  }

  private async writeGoogleFreeTrialOffer(
    subscription: GoogleSubscription,
    plan: GoogleBasePlan,
    existing?: GoogleSubscriptionOffer
  ): Promise<GoogleSubscriptionOffer> {
    const desired = this.buildFreeTrialOffer(subscription, plan)
    const trial = this.config.freeTrial
    if (!trial) throw new Error('Cannot write a Google free trial when freeTrial is disabled')
    const converted = await this.convertPrice(this.config.products[trial.target].priceUsd)
    const baseUrl = `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/subscriptions/${encodeURIComponent(subscription.productId)}/basePlans/${encodeURIComponent(plan.basePlanId)}/offers`
    const url = existing
      ? appendQuery(`${baseUrl}/${encodeURIComponent(this.config.google.freeTrialOfferId)}`, {
          updateMask: 'phases,targeting,regionalConfigs,otherRegionsConfig,offerTags',
          'regionsVersion.version': converted.regionVersion.version,
        })
      : appendQuery(baseUrl, {
          offerId: this.config.google.freeTrialOfferId,
          'regionsVersion.version': converted.regionVersion.version,
        })
    const result = await this.request<GoogleSubscriptionOffer>(url, {
      method: existing ? 'PATCH' : 'POST',
      body: desired,
    })
    if (!result) throw new Error('Google did not return the prepared free-trial offer')
    return result
  }

  private async setGoogleOfferActive(
    subscription: GoogleSubscription,
    offer: GoogleSubscriptionOffer,
    active: boolean
  ): Promise<void> {
    const action = active ? 'activate' : 'deactivate'
    await this.request(
      `/subscriptions/${encodeURIComponent(subscription.productId)}/basePlans/${encodeURIComponent(offer.basePlanId)}/offers/${encodeURIComponent(offer.offerId)}:${action}`,
      { method: 'POST', body: {} }
    )
  }

  private subscriptionListings(): GoogleSubscription['listings'] {
    return this.localizations.map((localization) => ({
      languageCode: localization.googleLocale,
      title: localization.google.subscription.title,
      benefits: localization.google.subscription.benefits,
      description: localization.google.subscription.description,
    }))
  }

  private lifetimeListings(): GoogleOneTimeProduct['listings'] {
    return this.localizations.map((localization) => ({
      languageCode: localization.googleLocale,
      title: localization.google.lifetime.title,
      description: localization.google.lifetime.description,
    }))
  }

  private async getSubscription(): Promise<GoogleSubscription | undefined> {
    return this.request<GoogleSubscription>(
      `/subscriptions/${encodeURIComponent(this.config.google.subscriptionProductId)}`,
      { allowNotFound: true }
    )
  }

  private async syncSubscription(): Promise<void> {
    const keys = enabledSubscriptionKeys(this.config)
    if (keys.length === 0) {
      this.reporter.info('No Google subscriptions enabled')
      return
    }

    let subscription = await this.getSubscription()
    if (!subscription) {
      if (this.reporter.command === 'apply') {
        const matrices = await Promise.all(
          keys.map(
            async (key) =>
              [
                key,
                await this.prepareRegionalPriceMatrix(this.config.products[key].priceUsd),
              ] as const
          )
        )
        const regionsVersion = matrices[0][1].regionVersion.version
        for (const [key, prices] of matrices) {
          if (prices.regionVersion.version !== regionsVersion) {
            throw new Error(
              'Google region versions changed while preparing subscription prices; retry'
            )
          }
          this.reportPppCoverage(`Google ${key}`, prices)
        }
        const body: GoogleSubscription = {
          packageName: this.environment.packageName,
          productId: this.config.google.subscriptionProductId,
          basePlans: matrices.map(([key, prices]) => this.buildBasePlan(key, prices)),
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
        if (!this.validateBasePlanPeriod(existing, key)) continue
        this.reporter.ok(`Google ${key} base plan`)
        const matrix = await this.prepareRegionalPriceMatrix(desired.priceUsd)
        this.reportPppCoverage(`Google ${key}`, matrix)
        this.verifyGooglePrice(
          `Google ${key}`,
          existing.regionalConfigs.map((item) => ({
            ...item,
            available: item.newSubscriberAvailability === true,
          })),
          matrix.regionalConfigs,
          {
            ...existing.otherRegionsConfig,
            available: existing.otherRegionsConfig.newSubscriberAvailability === true,
          },
          matrix.otherRegions
        )
        continue
      }

      if (this.reporter.command === 'apply') {
        const matrix = await this.prepareRegionalPriceMatrix(desired.priceUsd)
        this.reportPppCoverage(`Google ${key}`, matrix)
        const newPlan = this.buildBasePlan(key, matrix)
        const basePlans = [...subscription.basePlans.map(withoutState), newPlan]
        const url = appendQuery(
          `${API_ROOT}/${encodeURIComponent(this.environment.packageName)}/subscriptions/${encodeURIComponent(subscription.productId)}`,
          {
            updateMask: 'basePlans',
            'regionsVersion.version': matrix.regionVersion.version,
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

    await this.reconcileFreeTrial(subscription)
  }

  private async reconcileFreeTrial(subscription: GoogleSubscription): Promise<void> {
    const trial = this.config.freeTrial
    const offers = await this.listGoogleOffers(subscription)
    const conflicts = this.unknownActiveFreeOffers(offers)
    if (conflicts.length > 0) {
      this.reporter.error(
        `Google has ${conflicts.length} active free offer(s) not managed by the configured offer ID; resolve them in Play Console before continuing`
      )
      return
    }

    const managedId = this.config.google.freeTrialOfferId
    const managed = offers.filter(({ offer }) => offer.offerId === managedId)
    if (!trial) {
      const active = managed.filter(
        ({ offer }) => offer.state === 'ACTIVE' && this.isGoogleFreeOffer(offer)
      )
      if (active.length === 0) {
        this.reporter.ok('Google free trial is disabled')
      } else if (this.reporter.command === 'verify') {
        this.reporter.error('Google free trial is active but disabled in config')
      } else if (this.reporter.command === 'plan') {
        this.reporter.change(`deactivate ${active.length} Google free-trial offer(s)`)
      } else {
        this.reporter.info(
          'Google free-trial deactivation pending: npm run monetization:activate -- --confirm'
        )
      }
      return
    }

    const planId = this.config.products[trial.target].googleBasePlanId
    const plan = subscription.basePlans.find((item) => item.basePlanId === planId)
    if (!plan) {
      this.reporter.error(
        `Google ${trial.target} base plan is missing; run monetization:apply first`
      )
      return
    }
    const desired = managed.find(({ plan: item }) => item.basePlanId === planId)
    const staleActive = managed.filter(
      ({ plan: item, offer }) => item.basePlanId !== planId && offer.state === 'ACTIVE'
    )

    if (!desired) {
      if (this.reporter.command === 'apply') {
        await this.writeGoogleFreeTrialOffer(subscription, plan)
        this.reporter.change(
          `created Google ${trial.target} ${trial.duration} draft free-trial offer`
        )
      } else if (this.reporter.command === 'verify') {
        this.reporter.error(`Missing: Google ${trial.target} free-trial offer`)
      } else {
        this.reporter.change(`prepare Google ${trial.target} ${trial.duration} free-trial offer`)
      }
    } else {
      const differences = this.freeTrialOfferDifferences(desired.offer, subscription, plan)
      const matches = differences.length === 0
      const differenceDescription = differences
        .map((difference) =>
          difference === 'duration' ? `duration to ${trial.duration}` : difference
        )
        .join(', ')
      if (!matches && desired.offer.state !== 'ACTIVE' && this.reporter.command === 'apply') {
        await this.writeGoogleFreeTrialOffer(subscription, plan, desired.offer)
        this.reporter.change(
          `updated Google ${trial.target} ${trial.duration} inactive free-trial offer`
        )
      } else if (!matches && this.reporter.command === 'verify') {
        this.reporter.error(
          `Google ${trial.target} free-trial offer differs from config: ${differenceDescription}`
        )
      } else if (!matches && this.reporter.command === 'plan') {
        this.reporter.change(`update Google ${trial.target} free-trial ${differenceDescription}`)
      } else if (!matches) {
        this.reporter.info(
          'Google live free-trial update pending: npm run monetization:activate -- --confirm'
        )
      } else if (desired.offer.state === 'ACTIVE') {
        this.reporter.ok(`Google ${trial.target} ${trial.duration} free trial`)
      } else if (this.reporter.command === 'verify') {
        this.reporter.error(
          `Google ${trial.target} free-trial offer is ${desired.offer.state}; expected ACTIVE`
        )
      } else if (this.reporter.command === 'plan') {
        this.reporter.change(`activate Google ${trial.target} free-trial offer`)
      } else {
        this.reporter.info(
          'Google free-trial activation pending: npm run monetization:activate -- --confirm'
        )
      }
    }

    if (staleActive.length > 0) {
      if (this.reporter.command === 'verify') {
        this.reporter.error(
          `Google has ${staleActive.length} obsolete active managed free-trial offer(s)`
        )
      } else if (this.reporter.command === 'plan') {
        this.reporter.change(`deactivate ${staleActive.length} obsolete Google free-trial offer(s)`)
      } else {
        this.reporter.info(
          'Google obsolete free-trial deactivation pending: npm run monetization:activate -- --confirm'
        )
      }
    }
  }

  private async activateFreeTrial(): Promise<void> {
    const subscription = await this.getSubscription()
    if (!subscription) {
      if (this.config.freeTrial) {
        this.reporter.error('Google subscription is missing; run monetization:apply first')
      }
      return
    }

    const offers = await this.listGoogleOffers(subscription)
    const conflicts = this.unknownActiveFreeOffers(offers)
    if (conflicts.length > 0) {
      this.reporter.error(
        `Google has ${conflicts.length} active free offer(s) not managed by the configured offer ID; no trial state was changed`
      )
      return
    }

    const trial = this.config.freeTrial
    if (!trial) {
      const active = offers.filter(
        ({ offer }) =>
          offer.offerId === this.config.google.freeTrialOfferId &&
          offer.state === 'ACTIVE' &&
          this.isGoogleFreeOffer(offer)
      )
      for (const { offer } of active) {
        await this.setGoogleOfferActive(subscription, offer, false)
      }
      if (active.length > 0) {
        this.reporter.change(`deactivated ${active.length} Google free-trial offer(s)`)
      } else {
        this.reporter.ok('Google free trial is disabled')
      }
      return
    }

    const planId = this.config.products[trial.target].googleBasePlanId
    const plan = subscription.basePlans.find((item) => item.basePlanId === planId)
    const desired = offers.find(
      ({ plan: item, offer }) =>
        item.basePlanId === planId && offer.offerId === this.config.google.freeTrialOfferId
    )
    if (!plan || !desired) {
      this.reporter.error(
        `Google ${trial.target} free-trial offer is missing; run monetization:apply first`
      )
      return
    }

    let desiredOffer = desired.offer
    if (this.freeTrialOfferDifferences(desiredOffer, subscription, plan).length > 0) {
      if (desiredOffer.state === 'ACTIVE') {
        await this.setGoogleOfferActive(subscription, desiredOffer, false)
        this.reporter.change(`deactivated Google ${trial.target} free trial for update`)
        desiredOffer = { ...desiredOffer, state: 'INACTIVE' }
      }
      desiredOffer = await this.writeGoogleFreeTrialOffer(subscription, plan, desiredOffer)
      this.reporter.change(`updated Google ${trial.target} free trial to ${trial.duration}`)
    }

    if (desiredOffer.state !== 'ACTIVE') {
      await this.setGoogleOfferActive(subscription, desiredOffer, true)
      this.reporter.change(`activated Google ${trial.target} ${trial.duration} free trial`)
    } else {
      this.reporter.ok(`Google ${trial.target} ${trial.duration} free trial already active`)
    }

    const obsolete = offers.filter(
      ({ plan: item, offer }) =>
        item.basePlanId !== planId &&
        offer.offerId === this.config.google.freeTrialOfferId &&
        offer.state === 'ACTIVE'
    )
    for (const { offer } of obsolete) {
      await this.setGoogleOfferActive(subscription, offer, false)
    }
    if (obsolete.length > 0) {
      this.reporter.change(`deactivated ${obsolete.length} obsolete Google free-trial offer(s)`)
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
    regionalConfigs: Array<{ regionCode: string; price: GoogleMoney; available: boolean }>,
    desiredConfigs: Array<{ regionCode: string; price: GoogleMoney }>,
    otherRegions?: { usdPrice: GoogleMoney; eurPrice: GoogleMoney; available: boolean },
    desiredOtherRegions?: { usdPrice: GoogleMoney; eurPrice: GoogleMoney }
  ): void {
    const current = new Map(regionalConfigs.map((item) => [item.regionCode, item]))
    const desiredRegions = new Set(desiredConfigs.map((item) => item.regionCode))
    const mismatches = desiredConfigs.filter((item) => {
      const existing = current.get(item.regionCode)
      return !existing || !existing.available || !moneyEquals(existing.price, item.price)
    })
    const unexpectedRegions = regionalConfigs.filter((item) => !desiredRegions.has(item.regionCode))
    const otherRegionsMatch =
      !desiredOtherRegions ||
      (otherRegions !== undefined &&
        otherRegions.available &&
        moneyEquals(otherRegions.usdPrice, desiredOtherRegions.usdPrice) &&
        moneyEquals(otherRegions.eurPrice, desiredOtherRegions.eurPrice))
    if (mismatches.length > 0 || unexpectedRegions.length > 0 || !otherRegionsMatch) {
      const example = mismatches[0]
      const existing = example ? current.get(example.regionCode) : undefined
      this.reporter.error(
        `${label} has ${mismatches.length + unexpectedRegions.length + (otherRegionsMatch ? 0 : 1)} regional price/availability difference(s)` +
          `${example ? `; ${example.regionCode} is ${existing ? `${formatMoney(existing.price)} (${existing.available ? 'available' : 'unavailable'})` : 'missing'}, expected ${formatMoney(example.price)} (available)` : unexpectedRegions[0] ? `; unexpected region ${unexpectedRegions[0].regionCode}` : '; future-region prices or availability differ'}. ` +
          'Initial setup will not change established prices; use monetization:prices:apply.'
      )
    } else {
      this.reporter.ok(`${label} prices match ${desiredConfigs.length} region(s)`)
    }
  }

  private async getLifetimePurchase(): Promise<GoogleOneTimeProduct | undefined> {
    return this.request<GoogleOneTimeProduct>(
      `/oneTimeProducts/${encodeURIComponent(this.config.products.lifetime.googleProductId)}`,
      { allowNotFound: true }
    )
  }

  private async syncLifetimePurchase(): Promise<void> {
    if (!isEnabled('lifetime', this.config)) {
      this.reporter.info('No Google lifetime purchase enabled')
      return
    }

    const desired = this.config.products.lifetime
    let purchase = await this.getLifetimePurchase()
    if (!purchase) {
      if (this.reporter.command === 'apply') {
        const matrix = await this.prepareRegionalPriceMatrix(desired.priceUsd)
        this.reportPppCoverage('Google lifetime', matrix)
        const body: GoogleOneTimeProduct = {
          packageName: this.environment.packageName,
          productId: desired.googleProductId,
          listings: this.lifetimeListings(),
          purchaseOptions: [
            {
              purchaseOptionId: desired.googlePurchaseOptionId,
              regionalPricingAndAvailabilityConfigs: matrix.regionalConfigs.map((item) => ({
                regionCode: item.regionCode,
                price: item.price,
                availability: 'AVAILABLE',
              })),
              newRegionsConfig: {
                usdPrice: matrix.otherRegions.usdPrice,
                eurPrice: matrix.otherRegions.eurPrice,
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
            'regionsVersion.version': matrix.regionVersion.version,
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
    const matrix = await this.prepareRegionalPriceMatrix(desired.priceUsd)
    this.reportPppCoverage('Google lifetime', matrix)
    this.verifyGooglePrice(
      'Google lifetime',
      option.regionalPricingAndAvailabilityConfigs.map((item) => ({
        ...item,
        available: item.availability === 'AVAILABLE',
      })),
      matrix.regionalConfigs,
      {
        ...option.newRegionsConfig,
        available: option.newRegionsConfig.availability === 'AVAILABLE',
      },
      matrix.otherRegions
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
    const keys = enabledSubscriptionKeys(this.config)
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
      } else if (!this.validateBasePlanPeriod(plan, key)) {
        continue
      } else if (plan.state === 'ACTIVE') {
        this.reporter.ok(`Google ${key} base plan already active`)
      } else if (plan.state !== 'DRAFT' && plan.state !== 'INACTIVE') {
        this.reporter.error(
          `Google ${key} base plan is ${plan.state}; only draft or inactive plans are activated`
        )
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
    if (!isEnabled('lifetime', this.config)) return
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
