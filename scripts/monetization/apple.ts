import { AppleMetadataReconciler } from './apple-metadata'
import type { MonetizationConfig, StoreEnvironment } from './types'
import type {
  JsonApiListResponse,
  JsonApiResource,
  JsonApiSingleResponse,
  SubscriptionProductKey,
} from './types'
import { AppleAuth } from './auth'
import { APPLE_FREE_TRIAL_DURATION } from './free-trial'
import { appendQuery, requestJson } from './http'
import type { JsonRequester } from './http'
import { enabledSubscriptionKeys, isEnabled } from './config'
import { loadStoreLocalizations } from './localizations'
import { adjustedPriceUsd, RegionalPricingResolver, selectClosestUsdPrice } from './ppp'
import { Reporter } from './reporter'

const API_ROOT = 'https://api.appstoreconnect.apple.com'

interface SubscriptionAttributes {
  name: string
  productId: string
  subscriptionPeriod: string
  familySharable?: boolean
  reviewNote?: string
  state?: string
}

interface InAppPurchaseAttributes {
  name: string
  productId: string
  inAppPurchaseType: string
  reviewNote?: string
  state?: string
}

interface PricePointAttributes {
  customerPrice: string
  priceTier?: string
}

interface SubscriptionPlanAvailabilityAttributes {
  availableInNewTerritories: boolean
  planType: 'MONTHLY' | 'UPFRONT'
}

interface InAppPurchaseAvailabilityAttributes {
  availableInNewTerritories: boolean
}

interface SubscriptionIntroductoryOfferAttributes {
  duration: string
  endDate?: string | null
  numberOfPeriods: number
  offerMode: string
  startDate?: string | null
  targetSubscriptionPlanType?: string
}

interface AppleFreeTrialOffer {
  key: SubscriptionProductKey
  resource: JsonApiResource<SubscriptionIntroductoryOfferAttributes>
  territoryId?: string
}

interface AppleRegionalPriceTarget {
  territoryId: string
  point: JsonApiResource<PricePointAttributes>
  multiplier: number
  sourceYear?: number
  rawRatio?: number
  fallback: boolean
  currency?: string
}

const SUBSCRIPTION_PERIOD: Record<SubscriptionProductKey, string> = {
  weekly: 'ONE_WEEK',
  monthly: 'ONE_MONTH',
  yearly: 'ONE_YEAR',
}
const SUBSCRIPTION_KEYS: SubscriptionProductKey[] = ['weekly', 'monthly', 'yearly']
const SUBSCRIPTION_PLAN_TYPE = 'UPFRONT' as const

const today = (): string => new Date().toISOString().slice(0, 10)
const decimalMagnitude = (value: string): { magnitude: bigint; scale: number } => {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) throw new Error(`Invalid store price: ${value}`)
  const fraction = match[2] ?? ''
  return { magnitude: BigInt(`${match[1]}${fraction}`), scale: fraction.length }
}
const compareDecimal = (left: string, right: string): number => {
  const a = decimalMagnitude(left)
  const b = decimalMagnitude(right)
  const scale = Math.max(a.scale, b.scale)
  const leftValue = a.magnitude * 10n ** BigInt(scale - a.scale)
  const rightValue = b.magnitude * 10n ** BigInt(scale - b.scale)
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}
const runWithConcurrency = async <T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>
): Promise<void> => {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex]
      nextIndex += 1
      await task(item)
    }
  })
  await Promise.all(workers)
}

const sameIdentifierSet = (
  left: readonly { id: string }[],
  right: readonly { id: string }[]
): boolean => {
  if (left.length !== right.length) return false
  const rightIds = new Set(right.map((item) => item.id))
  return left.every((item) => rightIds.has(item.id))
}

export class AppleStoreClient {
  private readonly auth: AppleAuth
  private readonly metadata: AppleMetadataReconciler
  private appId: string | undefined
  private territoryIdentifiers: Array<{ type: 'territories'; id: string }> | undefined
  private readonly territoryCurrencies = new Map<string, string>()
  private readonly regionalPricing: RegionalPricingResolver

  constructor(
    private readonly config: MonetizationConfig,
    private readonly environment: NonNullable<StoreEnvironment['apple']>,
    private readonly reporter: Reporter,
    private readonly requestOverride?: JsonRequester
  ) {
    this.auth = new AppleAuth(environment.issuerId, environment.keyId, environment.keyFilepath)
    this.regionalPricing = new RegionalPricingResolver(config)
    this.metadata = new AppleMetadataReconciler(
      config,
      loadStoreLocalizations(),
      reporter,
      async <T>(pathOrUrl: string, options = {}) => this.request<T>(pathOrUrl, options),
      async <T extends JsonApiResource>(pathOrUrl: string) => this.listAll<T>(pathOrUrl)
    )
  }

  private async request<T>(
    pathOrUrl: string,
    options: Parameters<typeof requestJson<T>>[1] = {}
  ): Promise<T | undefined> {
    if (this.requestOverride) return this.requestOverride<T>(pathOrUrl, options)
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_ROOT}${pathOrUrl}`
    return requestJson<T>(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.auth.getToken()}`,
        ...options.headers,
      },
    })
  }

  private async listAll<T extends JsonApiResource>(pathOrUrl: string): Promise<T[]> {
    const items: T[] = []
    let next: string | undefined = pathOrUrl

    while (next) {
      const response: JsonApiListResponse<T> | undefined = await this.request(next)
      if (!response) break
      items.push(...response.data)
      next = response.links?.next
    }

    return items
  }

  private async listAllWithIncluded<T extends JsonApiResource>(
    pathOrUrl: string
  ): Promise<{ data: T[]; included: JsonApiResource[] }> {
    const data: T[] = []
    const included: JsonApiResource[] = []
    let next: string | undefined = pathOrUrl
    while (next) {
      const response: JsonApiListResponse<T> | undefined = await this.request(next)
      if (!response) break
      data.push(...response.data)
      included.push(...(response.included ?? []))
      next = response.links?.next
    }
    return { data, included }
  }

  async sync(): Promise<void> {
    this.reporter.section('App Store Connect')
    this.appId = await this.resolveAppId()
    await this.syncSubscriptions()
    await this.syncLifetimePurchase()
  }

  async activate(): Promise<void> {
    this.reporter.section('App Store Connect free-trial activation')
    this.appId = await this.resolveAppId()
    const groups = await this.listAll<JsonApiResource<{ referenceName: string }>>(
      `/v1/apps/${this.requiredAppId()}/subscriptionGroups?limit=200`
    )
    const group = groups.find(
      (item) => item.attributes.referenceName === this.config.apple.subscriptionGroupReferenceName
    )
    if (!group) {
      if (this.config.freeTrial) {
        this.reporter.error('Apple subscription group is missing; run monetization:apply first')
      } else {
        this.reporter.ok('Apple free trial is disabled')
      }
      return
    }

    const subscriptions = await this.listAll<JsonApiResource<SubscriptionAttributes>>(
      `/v1/subscriptionGroups/${group.id}/subscriptions?limit=200`
    )
    await this.activateFreeTrial(this.configuredSubscriptions(subscriptions))
  }

  async syncPrices(): Promise<void> {
    this.reporter.section('App Store Connect regional prices')
    this.appId = await this.resolveAppId()
    const groups = await this.listAll<JsonApiResource<{ referenceName: string }>>(
      `/v1/apps/${this.requiredAppId()}/subscriptionGroups?limit=200`
    )
    const group = groups.find(
      (item) => item.attributes.referenceName === this.config.apple.subscriptionGroupReferenceName
    )
    const subscriptions = group
      ? await this.listAll<JsonApiResource<SubscriptionAttributes>>(
          `/v1/subscriptionGroups/${group.id}/subscriptions?limit=200`
        )
      : []
    for (const key of enabledSubscriptionKeys(this.config)) {
      const subscription = subscriptions.find(
        (item) => item.attributes.productId === this.config.products[key].appleProductId
      )
      if (!subscription) {
        this.reporter.error(`Missing: Apple ${key} subscription; run monetization:apply first`)
        continue
      }
      await this.reconcileSubscriptionPrice(subscription.id, key, true)
    }

    if (isEnabled('lifetime', this.config)) {
      const purchases = await this.listAll<JsonApiResource<InAppPurchaseAttributes>>(
        `/v1/apps/${this.requiredAppId()}/inAppPurchasesV2?limit=200`
      )
      const purchase = purchases.find(
        (item) => item.attributes.productId === this.config.products.lifetime.appleProductId
      )
      if (!purchase) {
        this.reporter.error('Missing: Apple lifetime purchase; run monetization:apply first')
      } else {
        await this.reconcileLifetimePrice(purchase.id, true)
      }
    }
  }

  private async resolveAppId(): Promise<string> {
    const response = await this.request<
      JsonApiListResponse<JsonApiResource<{ bundleId: string; name: string }>>
    >(
      appendQuery(`${API_ROOT}/v1/apps`, {
        'filter[bundleId]': this.environment.bundleIdentifier,
        limit: 2,
      })
    )
    const matches = response?.data.filter(
      (app) => app.attributes.bundleId === this.environment.bundleIdentifier
    )
    if (!matches || matches.length === 0) {
      throw new Error(
        `No App Store Connect app found for bundle ID ${this.environment.bundleIdentifier}`
      )
    }
    if (matches.length > 1) {
      throw new Error(
        `Multiple App Store Connect apps found for bundle ID ${this.environment.bundleIdentifier}`
      )
    }
    this.reporter.ok(`Apple app ${this.environment.bundleIdentifier}`)
    return matches[0].id
  }

  private requiredAppId(): string {
    if (!this.appId) throw new Error('Apple app ID has not been resolved')
    return this.appId
  }

  private async syncSubscriptions(): Promise<void> {
    const keys = enabledSubscriptionKeys(this.config)
    if (keys.length === 0) {
      this.reporter.info('No Apple subscriptions enabled')
      const groups = await this.listAll<JsonApiResource<{ referenceName: string }>>(
        `/v1/apps/${this.requiredAppId()}/subscriptionGroups?limit=200`
      )
      const group = groups.find(
        (item) => item.attributes.referenceName === this.config.apple.subscriptionGroupReferenceName
      )
      if (!group) {
        this.reporter.ok('Apple free trial is disabled')
        return
      }
      const subscriptions = await this.listAll<JsonApiResource<SubscriptionAttributes>>(
        `/v1/subscriptionGroups/${group.id}/subscriptions?limit=200`
      )
      await this.reconcileFreeTrial(this.configuredSubscriptions(subscriptions))
      return
    }

    const groups = await this.listAll<JsonApiResource<{ referenceName: string }>>(
      `/v1/apps/${this.requiredAppId()}/subscriptionGroups?limit=200`
    )
    let group = groups.find(
      (item) => item.attributes.referenceName === this.config.apple.subscriptionGroupReferenceName
    )

    group = await this.reporter.ensure('Apple subscription group', group, async () => {
      const response = await this.request<
        JsonApiSingleResponse<JsonApiResource<{ referenceName: string }>>
      >('/v1/subscriptionGroups', {
        method: 'POST',
        body: {
          data: {
            type: 'subscriptionGroups',
            attributes: {
              referenceName: this.config.apple.subscriptionGroupReferenceName,
            },
            relationships: {
              app: { data: { type: 'apps', id: this.requiredAppId() } },
            },
          },
        },
      })
      if (!response) throw new Error('Apple did not return the created subscription group')
      return response.data
    })

    if (!group) {
      for (const key of keys) {
        this.reporter.change(
          `create Apple ${key} subscription, localization, availability, and initial prices`
        )
      }
      return
    }

    await this.metadata.syncSubscriptionGroup(group.id)
    const subscriptions = await this.listAll<JsonApiResource<SubscriptionAttributes>>(
      `/v1/subscriptionGroups/${group.id}/subscriptions?limit=200`
    )
    const resolvedSubscriptions = this.configuredSubscriptions(subscriptions)

    for (const key of keys) {
      const desired = this.config.products[key]
      let subscription = subscriptions.find(
        (item) => item.attributes.productId === desired.appleProductId
      )
      subscription = await this.reporter.ensure(
        `Apple ${key} subscription`,
        subscription,
        async () => {
          const response = await this.request<
            JsonApiSingleResponse<JsonApiResource<SubscriptionAttributes>>
          >('/v1/subscriptions', {
            method: 'POST',
            body: {
              data: {
                type: 'subscriptions',
                attributes: {
                  name: desired.referenceName,
                  productId: desired.appleProductId,
                  subscriptionPeriod: SUBSCRIPTION_PERIOD[key],
                  familySharable: this.config.apple.familySharable,
                  reviewNote: this.config.apple.reviewNote,
                  groupLevel: 1,
                },
                relationships: {
                  group: { data: { type: 'subscriptionGroups', id: group.id } },
                },
              },
            },
          })
          if (!response) throw new Error(`Apple did not return the created ${key} subscription`)
          return response.data
        }
      )

      if (!subscription) {
        this.reporter.change(`create Apple ${key} localization, availability, and initial prices`)
        continue
      }
      resolvedSubscriptions.set(key, subscription)
      await this.syncSubscriptionAttributes(subscription, key)
      await this.metadata.syncSubscription(subscription.id, key)
      await this.ensureSubscriptionAvailability(subscription.id, key)
      await this.ensureSubscriptionPrice(subscription.id, key)
    }

    await this.reconcileFreeTrial(resolvedSubscriptions)
  }

  private configuredSubscriptions(
    subscriptions: JsonApiResource<SubscriptionAttributes>[]
  ): Map<SubscriptionProductKey, JsonApiResource<SubscriptionAttributes>> {
    const resolved = new Map<SubscriptionProductKey, JsonApiResource<SubscriptionAttributes>>()
    for (const key of SUBSCRIPTION_KEYS) {
      const productId = this.config.products[key].appleProductId
      const subscription = subscriptions.find((item) => item.attributes.productId === productId)
      if (subscription) resolved.set(key, subscription)
    }
    return resolved
  }

  private async listAppleFreeTrials(
    subscriptions: Map<SubscriptionProductKey, JsonApiResource<SubscriptionAttributes>>
  ): Promise<AppleFreeTrialOffer[]> {
    const offers: AppleFreeTrialOffer[] = []
    for (const [key, subscription] of subscriptions) {
      const subscriptionOffers = await this.listAll<
        JsonApiResource<SubscriptionIntroductoryOfferAttributes>
      >(`/v1/subscriptions/${subscription.id}/introductoryOffers?limit=200&include=territory`)
      offers.push(
        ...subscriptionOffers
          .filter((offer) => offer.attributes.offerMode === 'FREE_TRIAL')
          .map((resource) => {
            const territoryData = resource.relationships?.territory?.data
            const territory = Array.isArray(territoryData) ? territoryData[0] : territoryData
            return { key, resource, territoryId: territory?.id }
          })
      )
    }
    return offers
  }

  private appleFreeTrialMatches(offer: AppleFreeTrialOffer): boolean {
    const desired = this.config.freeTrial
    if (!desired || offer.key !== desired.target) return false
    const attributes = offer.resource.attributes
    return (
      attributes.offerMode === 'FREE_TRIAL' &&
      attributes.duration === APPLE_FREE_TRIAL_DURATION[desired.duration] &&
      attributes.numberOfPeriods === 1 &&
      attributes.targetSubscriptionPlanType === SUBSCRIPTION_PLAN_TYPE
    )
  }

  private async reconcileFreeTrial(
    subscriptions: Map<SubscriptionProductKey, JsonApiResource<SubscriptionAttributes>>
  ): Promise<void> {
    const desired = this.config.freeTrial
    const offers = await this.listAppleFreeTrials(subscriptions)
    const matching = offers.filter((offer) => this.appleFreeTrialMatches(offer))
    const territoryIds = desired
      ? (await this.allTerritoryIdentifiers()).map((territory) => territory.id)
      : []
    const matchingTerritoryIds = new Set(matching.map((offer) => offer.territoryId))
    const exact = desired
      ? matching.length === territoryIds.length &&
        offers.length === territoryIds.length &&
        territoryIds.every((territoryId) => matchingTerritoryIds.has(territoryId))
      : offers.length === 0

    if (exact) {
      this.reporter.ok(
        desired
          ? `Apple ${desired.target} ${desired.duration} free trial in ${territoryIds.length} storefront(s)`
          : 'Apple free trial is disabled'
      )
      return
    }

    const description = desired
      ? `transition Apple free trial to ${desired.target} ${desired.duration} in ${territoryIds.length} storefront(s)`
      : 'remove Apple free trial'
    if (this.reporter.command === 'verify') {
      this.reporter.error(`Apple free trial differs from config: ${description}`)
    } else if (this.reporter.command === 'plan') {
      this.reporter.change(description)
    } else {
      this.reporter.info(
        `Apple free-trial transition pending: npm run monetization:activate -- --confirm`
      )
    }
  }

  private async activateFreeTrial(
    subscriptions: Map<SubscriptionProductKey, JsonApiResource<SubscriptionAttributes>>
  ): Promise<void> {
    const desired = this.config.freeTrial
    const offers = await this.listAppleFreeTrials(subscriptions)

    if (!desired) {
      for (const offer of offers) {
        await this.request(`/v1/subscriptionIntroductoryOffers/${offer.resource.id}`, {
          method: 'DELETE',
        })
      }
      if (offers.length > 0) {
        this.reporter.change(`removed ${offers.length} Apple free-trial offer(s)`)
      } else {
        this.reporter.ok('Apple free trial is disabled')
      }
      return
    }

    const subscription = subscriptions.get(desired.target)
    if (!subscription) {
      this.reporter.error(
        `Apple ${desired.target} subscription is missing; run monetization:apply first`
      )
      return
    }

    const territories = await this.allTerritoryIdentifiers()
    const keptIds = new Set<string>()
    const missingTerritories = territories.filter((territory) => {
      const existing = offers.find(
        (offer) =>
          !keptIds.has(offer.resource.id) &&
          offer.territoryId === territory.id &&
          this.appleFreeTrialMatches(offer)
      )
      if (!existing) return true
      keptIds.add(existing.resource.id)
      return false
    })

    await runWithConcurrency(missingTerritories, 5, async (territory) => {
      const response = await this.request<
        JsonApiSingleResponse<JsonApiResource<SubscriptionIntroductoryOfferAttributes>>
      >('/v1/subscriptionIntroductoryOffers', {
        method: 'POST',
        body: {
          data: {
            type: 'subscriptionIntroductoryOffers',
            attributes: {
              duration: APPLE_FREE_TRIAL_DURATION[desired.duration],
              numberOfPeriods: 1,
              offerMode: 'FREE_TRIAL',
              startDate: today(),
              targetSubscriptionPlanType: SUBSCRIPTION_PLAN_TYPE,
            },
            relationships: {
              subscription: {
                data: { type: 'subscriptions', id: subscription.id },
              },
              territory: {
                data: territory,
              },
            },
          },
        },
      })
      if (!response) throw new Error('Apple did not return the created free-trial offer')
      keptIds.add(response.data.id)
    })
    if (missingTerritories.length > 0) {
      this.reporter.change(
        `created Apple ${desired.target} ${desired.duration} free trial in ${missingTerritories.length} storefront(s)`
      )
    }

    const obsolete = offers.filter((offer) => !keptIds.has(offer.resource.id))
    await runWithConcurrency(obsolete, 5, async (offer) => {
      await this.request(`/v1/subscriptionIntroductoryOffers/${offer.resource.id}`, {
        method: 'DELETE',
      })
    })
    if (obsolete.length > 0) {
      this.reporter.change(`removed ${obsolete.length} obsolete Apple free-trial offer(s)`)
    }
    if (missingTerritories.length === 0 && obsolete.length === 0) {
      this.reporter.ok(
        `Apple ${desired.target} ${desired.duration} free trial already active in ${territories.length} storefront(s)`
      )
    }
  }

  private async allTerritoryIdentifiers(): Promise<Array<{ type: 'territories'; id: string }>> {
    if (!this.territoryIdentifiers) {
      const territories = await this.listAll<JsonApiResource>(
        appendQuery(`${API_ROOT}/v1/territories`, { limit: 200 })
      )
      for (const territory of territories) {
        const currency = (territory.attributes as { currency?: unknown }).currency
        if (typeof currency === 'string') this.territoryCurrencies.set(territory.id, currency)
      }
      this.territoryIdentifiers = territories.map((territory) => ({
        type: 'territories',
        id: territory.id,
      }))
    }
    return this.territoryIdentifiers
  }

  private async ensureSubscriptionAvailability(
    subscriptionId: string,
    key: SubscriptionProductKey
  ): Promise<void> {
    const availabilities = await this.listAll<
      JsonApiResource<SubscriptionPlanAvailabilityAttributes>
    >(`/v1/subscriptions/${subscriptionId}/planAvailabilities?limit=200`)
    const current = availabilities.find(
      (availability) => availability.attributes.planType === SUBSCRIPTION_PLAN_TYPE
    )
    const desiredTerritories = await this.allTerritoryIdentifiers()

    if (!current) {
      await this.reporter.ensure(
        `Apple ${key} availability in all storefronts`,
        current,
        async () => {
          const response = await this.request<
            JsonApiSingleResponse<JsonApiResource<SubscriptionPlanAvailabilityAttributes>>
          >('/v1/subscriptionPlanAvailabilities', {
            method: 'POST',
            body: {
              data: {
                type: 'subscriptionPlanAvailabilities',
                attributes: {
                  planType: SUBSCRIPTION_PLAN_TYPE,
                  availableInNewTerritories: true,
                },
                relationships: {
                  subscription: {
                    data: { type: 'subscriptions', id: subscriptionId },
                  },
                  availableTerritories: { data: desiredTerritories },
                },
              },
            },
          })
          if (!response) {
            throw new Error(`Apple did not return the created ${key} subscription availability`)
          }
          return response.data
        }
      )
      return
    }

    const currentTerritories = await this.listAll<JsonApiResource>(
      `/v1/subscriptionPlanAvailabilities/${current.id}/availableTerritories?limit=200`
    )
    const matches =
      current.attributes.availableInNewTerritories === true &&
      sameIdentifierSet(currentTerritories, desiredTerritories)
    if (matches) {
      this.reporter.ok(`Apple ${key} availability in all storefronts`)
      return
    }

    if (this.reporter.command === 'verify') {
      this.reporter.error(`Apple ${key} storefront availability differs from config`)
    } else if (this.reporter.command === 'plan') {
      this.reporter.change(`update Apple ${key} availability in all storefronts`)
    } else {
      await this.request(`/v1/subscriptionPlanAvailabilities/${current.id}`, {
        method: 'PATCH',
        body: {
          data: {
            type: 'subscriptionPlanAvailabilities',
            id: current.id,
            attributes: { availableInNewTerritories: true },
            relationships: {
              availableTerritories: { data: desiredTerritories },
            },
          },
        },
      })
      this.reporter.change(`updated Apple ${key} availability in all storefronts`)
    }
  }

  private async syncSubscriptionAttributes(
    subscription: JsonApiResource<SubscriptionAttributes>,
    key: SubscriptionProductKey
  ): Promise<void> {
    const desired = this.config.products[key]
    const differs =
      subscription.attributes.name !== desired.referenceName ||
      subscription.attributes.familySharable !== this.config.apple.familySharable ||
      (subscription.attributes.reviewNote ?? '') !== this.config.apple.reviewNote
    if (!differs) {
      this.reporter.ok(`Apple ${key} internal metadata`)
      return
    }

    if (this.reporter.command === 'verify') {
      this.reporter.error(`Apple ${key} internal metadata differs from config`)
    } else if (this.reporter.command === 'plan') {
      this.reporter.change(`update Apple ${key} internal metadata`)
    } else {
      await this.request(`/v1/subscriptions/${subscription.id}`, {
        method: 'PATCH',
        body: {
          data: {
            type: 'subscriptions',
            id: subscription.id,
            attributes: {
              name: desired.referenceName,
              familySharable: this.config.apple.familySharable,
              reviewNote: this.config.apple.reviewNote,
            },
          },
        },
      })
      this.reporter.change(`updated Apple ${key} internal metadata`)
    }
  }

  private async ensureSubscriptionPrice(
    subscriptionId: string,
    key: SubscriptionProductKey
  ): Promise<void> {
    await this.reconcileSubscriptionPrice(subscriptionId, key, false)
  }

  private async reconcileSubscriptionPrice(
    subscriptionId: string,
    key: SubscriptionProductKey,
    laterChange: boolean
  ): Promise<void> {
    const targets = await this.appleRegionalTargets(
      'subscription',
      subscriptionId,
      this.config.products[key].priceUsd
    )
    const currentResponse = await this.listAllWithIncluded<
      JsonApiResource<{ startDate?: string | null }>
    >(
      appendQuery(`${API_ROOT}/v1/subscriptions/${subscriptionId}/prices`, {
        include: 'subscriptionPricePoint,territory',
        limit: 200,
      })
    )
    const existingPrices = currentResponse.data
    const futurePrices = existingPrices.filter(
      (price) => price.attributes.startDate && price.attributes.startDate > today()
    )
    if (futurePrices.length > 0) {
      this.reporter.error(
        `Apple ${key} has ${futurePrices.length} scheduled future price(s); remove or complete them in App Store Connect before reconciliation`
      )
      return
    }
    const includedPoints = new Map(
      currentResponse.included
        .filter((item) => item.type === 'subscriptionPricePoints')
        .map((item) => [item.id, item as JsonApiResource<PricePointAttributes>])
    )
    const currentByTerritory = new Map<string, JsonApiResource<PricePointAttributes>>()
    for (const price of [...existingPrices].sort((left, right) =>
      String(left.attributes.startDate ?? '').localeCompare(
        String(right.attributes.startDate ?? '')
      )
    )) {
      if (price.attributes.startDate && price.attributes.startDate > today()) continue
      const relationship = price.relationships?.subscriptionPricePoint?.data
      const identifier = Array.isArray(relationship) ? relationship[0] : relationship
      const point = identifier ? includedPoints.get(identifier.id) : undefined
      const territoryRelationship =
        price.relationships?.territory?.data ?? point?.relationships?.territory?.data
      const territory = Array.isArray(territoryRelationship)
        ? territoryRelationship[0]
        : territoryRelationship
      if (territory && point) currentByTerritory.set(territory.id, point)
    }
    if (existingPrices.length > 0 && currentByTerritory.size === 0) {
      throw new Error(
        `Apple ${key} returned existing prices without territory details; refusing an unsafe reconciliation`
      )
    }
    const existingPointIds = new Set([...currentByTerritory.values()].map((point) => point.id))
    const targetPointIds = new Set(targets.map((target) => target.point.id))
    const missingTargets = targets.filter((target) => !existingPointIds.has(target.point.id))
    const conflictingPointIds = [...existingPointIds].filter((id) => !targetPointIds.has(id))

    if (missingTargets.length === 0 && conflictingPointIds.length === 0) {
      this.reporter.ok(`Apple ${key} prices match ${targets.length} storefronts`)
      return
    }

    if (!laterChange && conflictingPointIds.length > 0) {
      this.reporter.error(
        `Apple ${key} has established regional prices that differ from config; use monetization:prices:apply`
      )
      return
    }

    if (this.reporter.command === 'verify' || this.reporter.command === 'prices-verify') {
      this.reporter.error(`Apple ${key} differs in ${missingTargets.length} storefront(s)`)
      return
    }
    if (this.reporter.command === 'plan' || this.reporter.command === 'prices-plan') {
      const sample = missingTargets[0]
      const currentPoint = sample ? currentByTerritory.get(sample.territoryId) : undefined
      const details = sample
        ? `; ${sample.territoryId}: ${currentPoint?.attributes.customerPrice ?? 'missing'} → ${sample.point.attributes.customerPrice}, ` +
          `ratio ${sample.rawRatio === undefined ? 'unavailable' : sample.rawRatio.toFixed(3)}, band ${sample.multiplier}, ` +
          `anchor $${adjustedPriceUsd(this.config.products[key].priceUsd, sample.multiplier)}, ` +
          `${sample.sourceYear === undefined ? 'no source year' : `source ${sample.sourceYear}`}, ${sample.fallback ? '1.0 fallback' : 'automatic/override'}`
        : ''
      this.reporter.change(
        `${laterChange ? 'update' : 'configure'} Apple ${key} prices in ${missingTargets.length} storefront(s)${details}`
      )
      if (this.reporter.command === 'prices-plan') {
        for (const target of missingTargets) {
          const existing = currentByTerritory.get(target.territoryId)
          const format = (value: string): string =>
            target.currency
              ? new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: target.currency,
                  currencyDisplay: 'narrowSymbol',
                }).format(Number(value))
              : value
          this.reporter.info(
            `${target.territoryId}: ${existing ? format(existing.attributes.customerPrice) : 'missing'} → ${format(target.point.attributes.customerPrice)}; ` +
              `source ${target.sourceYear ?? 'none'}, ratio ${target.rawRatio?.toFixed(3) ?? 'unavailable'}, band ${target.multiplier}, ` +
              `anchor $${adjustedPriceUsd(this.config.products[key].priceUsd, target.multiplier)}, ${target.fallback ? '1.0 fallback' : 'automatic/override'}`
          )
        }
      }
      return
    }

    await runWithConcurrency(missingTargets, 5, async (target) => {
      const currentPoint = currentByTerritory.get(target.territoryId)
      const preserveCurrentPrice =
        laterChange &&
        currentPoint !== undefined &&
        compareDecimal(
          target.point.attributes.customerPrice,
          currentPoint.attributes.customerPrice
        ) > 0
      await this.request('/v1/subscriptionPrices', {
        method: 'POST',
        body: {
          data: {
            type: 'subscriptionPrices',
            attributes: {
              startDate: null,
              planType: SUBSCRIPTION_PLAN_TYPE,
              ...(laterChange ? { preserveCurrentPrice } : {}),
            },
            relationships: {
              subscription: { data: { type: 'subscriptions', id: subscriptionId } },
              subscriptionPricePoint: {
                data: { type: 'subscriptionPricePoints', id: target.point.id },
              },
            },
          },
        },
      })
    })
    this.reporter.change(
      `${laterChange ? 'updated' : 'configured'} Apple ${key} prices in ${missingTargets.length} storefront(s)`
    )
  }

  private async appleRegionalTargets(
    kind: 'subscription' | 'lifetime',
    productId: string,
    priceUsd: string
  ): Promise<AppleRegionalPriceTarget[]> {
    const pointPath =
      kind === 'subscription'
        ? `/v1/subscriptions/${productId}/pricePoints`
        : `/v2/inAppPurchases/${productId}/pricePoints`
    const points = await this.listAll<JsonApiResource<PricePointAttributes>>(
      appendQuery(`${API_ROOT}${pointPath}`, {
        'filter[territory]': this.config.apple.baseTerritory,
        limit: 200,
      })
    )
    const territories = await this.allTerritoryIdentifiers()
    const assignments = new Map(
      territories.map((territory) => [territory.id, this.regionalPricing.forApple(territory.id)])
    )
    const selectedByMultiplier = new Map(
      this.regionalPricing
        .usedMultipliers(assignments.values())
        .map((multiplier) => [
          multiplier,
          selectClosestUsdPrice(adjustedPriceUsd(priceUsd, multiplier), points),
        ])
    )
    const equalizedByMultiplier = new Map<
      number,
      Map<string, JsonApiResource<PricePointAttributes>>
    >()

    await Promise.all(
      [...selectedByMultiplier].map(async ([multiplier, point]) => {
        const equalizationType =
          kind === 'subscription' ? 'subscriptionPricePoints' : 'inAppPurchasePricePoints'
        const equalizations = await this.listAll<JsonApiResource<PricePointAttributes>>(
          appendQuery(`${API_ROOT}/v1/${equalizationType}/${point.id}/equalizations`, {
            include: 'territory',
            limit: 200,
          })
        )
        const byTerritory = new Map<string, JsonApiResource<PricePointAttributes>>()
        byTerritory.set(this.config.apple.baseTerritory, point)
        for (const equalization of equalizations) {
          const relationship = equalization.relationships?.territory?.data
          const territory = Array.isArray(relationship) ? relationship[0] : relationship
          if (territory) byTerritory.set(territory.id, equalization)
        }
        equalizedByMultiplier.set(multiplier, byTerritory)
      })
    )

    const targets = territories.map((territory) => {
      const assignment = assignments.get(territory.id)
      if (!assignment) throw new Error(`Missing Apple PPP assignment for ${territory.id}`)
      const point = equalizedByMultiplier.get(assignment.multiplier)?.get(territory.id)
      if (!point) {
        throw new Error(
          `Apple did not return an equalized ${territory.id} price point for PPP band ${assignment.multiplier}`
        )
      }
      return {
        territoryId: territory.id,
        point,
        multiplier: assignment.multiplier,
        sourceYear: assignment.sourceYear,
        rawRatio: assignment.rawRatio,
        fallback: assignment.fallback,
        currency: this.territoryCurrencies.get(territory.id),
      }
    })
    const older = targets.filter(
      (target) =>
        target.sourceYear !== undefined &&
        this.regionalPricing.snapshot !== undefined &&
        target.sourceYear < this.regionalPricing.snapshot.targetYear
    )
    const fallback = targets.filter((target) => target.fallback)
    if (this.config.regionalPricing.strategy === 'ppp-bands') {
      this.reporter.info(
        `Apple ${kind} PPP: ${targets.length} storefronts, ${selectedByMultiplier.size} band(s), ${older.length} older-year, ${fallback.length} no-data fallback`
      )
    }
    return targets
  }

  private async syncLifetimePurchase(): Promise<void> {
    if (!isEnabled('lifetime', this.config)) {
      this.reporter.info('No Apple lifetime purchase enabled')
      return
    }

    const desired = this.config.products.lifetime
    const purchases = await this.listAll<JsonApiResource<InAppPurchaseAttributes>>(
      `/v1/apps/${this.requiredAppId()}/inAppPurchasesV2?limit=200`
    )
    let purchase = purchases.find((item) => item.attributes.productId === desired.appleProductId)
    purchase = await this.reporter.ensure('Apple lifetime non-consumable', purchase, async () => {
      const response = await this.request<
        JsonApiSingleResponse<JsonApiResource<InAppPurchaseAttributes>>
      >('/v2/inAppPurchases', {
        method: 'POST',
        body: {
          data: {
            type: 'inAppPurchases',
            attributes: {
              name: desired.referenceName,
              productId: desired.appleProductId,
              inAppPurchaseType: 'NON_CONSUMABLE',
              reviewNote: this.config.apple.reviewNote,
            },
            relationships: {
              app: { data: { type: 'apps', id: this.requiredAppId() } },
            },
          },
        },
      })
      if (!response) throw new Error('Apple did not return the created lifetime purchase')
      return response.data
    })

    if (!purchase) {
      this.reporter.change('create Apple lifetime localization, availability, and initial price')
      return
    }

    await this.syncLifetimeAttributes(purchase)
    await this.metadata.syncLifetimePurchase(purchase.id)
    await this.ensureLifetimeAvailability(purchase.id)
    await this.ensureLifetimePrice(purchase.id)
  }

  private async ensureLifetimeAvailability(purchaseId: string): Promise<void> {
    const response = await this.request<{
      data: JsonApiResource<InAppPurchaseAvailabilityAttributes> | null
    }>(`/v2/inAppPurchases/${purchaseId}/inAppPurchaseAvailability`, {
      allowNotFound: true,
    })
    const current = response?.data ?? undefined
    const desiredTerritories = await this.allTerritoryIdentifiers()

    const writeAvailability = async (): Promise<
      JsonApiResource<InAppPurchaseAvailabilityAttributes>
    > => {
      const created = await this.request<
        JsonApiSingleResponse<JsonApiResource<InAppPurchaseAvailabilityAttributes>>
      >('/v1/inAppPurchaseAvailabilities', {
        method: 'POST',
        body: {
          data: {
            type: 'inAppPurchaseAvailabilities',
            attributes: { availableInNewTerritories: true },
            relationships: {
              availableTerritories: { data: desiredTerritories },
              inAppPurchase: {
                data: { type: 'inAppPurchases', id: purchaseId },
              },
            },
          },
        },
      })
      if (!created) throw new Error('Apple did not return the lifetime purchase availability')
      return created.data
    }

    if (!current) {
      await this.reporter.ensure(
        'Apple lifetime availability in all storefronts',
        current,
        writeAvailability
      )
      return
    }

    const currentTerritories = await this.listAll<JsonApiResource>(
      `/v1/inAppPurchaseAvailabilities/${current.id}/availableTerritories?limit=200`
    )
    const matches =
      current.attributes.availableInNewTerritories === true &&
      sameIdentifierSet(currentTerritories, desiredTerritories)
    if (matches) {
      this.reporter.ok('Apple lifetime availability in all storefronts')
    } else if (this.reporter.command === 'verify') {
      this.reporter.error('Apple lifetime storefront availability differs from config')
    } else if (this.reporter.command === 'plan') {
      this.reporter.change('update Apple lifetime availability in all storefronts')
    } else {
      await writeAvailability()
      this.reporter.change('updated Apple lifetime availability in all storefronts')
    }
  }

  private async syncLifetimeAttributes(
    purchase: JsonApiResource<InAppPurchaseAttributes>
  ): Promise<void> {
    const desired = this.config.products.lifetime
    const differs =
      purchase.attributes.name !== desired.referenceName ||
      (purchase.attributes.reviewNote ?? '') !== this.config.apple.reviewNote
    if (!differs) {
      this.reporter.ok('Apple lifetime internal metadata')
      return
    }

    if (this.reporter.command === 'verify') {
      this.reporter.error('Apple lifetime internal metadata differs from config')
    } else if (this.reporter.command === 'plan') {
      this.reporter.change('update Apple lifetime internal metadata')
    } else {
      await this.request(`/v2/inAppPurchases/${purchase.id}`, {
        method: 'PATCH',
        body: {
          data: {
            type: 'inAppPurchases',
            id: purchase.id,
            attributes: {
              name: desired.referenceName,
              reviewNote: this.config.apple.reviewNote,
            },
          },
        },
      })
      this.reporter.change('updated Apple lifetime internal metadata')
    }
  }

  private async ensureLifetimePrice(purchaseId: string): Promise<void> {
    await this.reconcileLifetimePrice(purchaseId, false)
  }

  private async reconcileLifetimePrice(purchaseId: string, laterChange: boolean): Promise<void> {
    const targets = await this.appleRegionalTargets(
      'lifetime',
      purchaseId,
      this.config.products.lifetime.priceUsd
    )
    const schedule = await this.request<JsonApiSingleResponse<JsonApiResource>>(
      `/v2/inAppPurchases/${purchaseId}/iapPriceSchedule`,
      { allowNotFound: true }
    )
    const currentResponse = schedule
      ? await this.listAllWithIncluded<JsonApiResource<{ startDate?: string | null }>>(
          appendQuery(
            `${API_ROOT}/v1/inAppPurchasePriceSchedules/${schedule.data.id}/manualPrices`,
            { include: 'inAppPurchasePricePoint,territory', limit: 200 }
          )
        )
      : { data: [], included: [] }
    const currentPrices = currentResponse.data
    const futurePrices = currentPrices.filter(
      (price) => price.attributes.startDate && price.attributes.startDate > today()
    )
    if (futurePrices.length > 0) {
      this.reporter.error(
        `Apple lifetime has ${futurePrices.length} scheduled future price(s); resolve them in App Store Connect before reconciliation`
      )
      return
    }
    const currentPointIds = new Set(
      currentPrices.flatMap((item) => {
        const data = item.relationships?.inAppPurchasePricePoint?.data
        const identifiers = Array.isArray(data) ? data : data ? [data] : []
        return identifiers.map((identifier) => identifier.id)
      })
    )
    const targetPointIds = new Set(targets.map((target) => target.point.id))
    const matches =
      currentPointIds.size === targetPointIds.size &&
      [...targetPointIds].every((id) => currentPointIds.has(id))
    if (matches) {
      this.reporter.ok(`Apple lifetime prices match ${targets.length} storefronts`)
      return
    }
    if (schedule && !laterChange) {
      this.reporter.error(
        'Apple lifetime has an established regional price schedule; use monetization:prices:apply'
      )
      return
    }
    if (this.reporter.command === 'verify' || this.reporter.command === 'prices-verify') {
      this.reporter.error(
        `Apple lifetime regional prices differ in ${targets.length} storefront(s)`
      )
      return
    }
    if (this.reporter.command === 'plan' || this.reporter.command === 'prices-plan') {
      this.reporter.change(
        `${laterChange ? 'replace' : 'configure'} Apple lifetime regional price schedule (${targets.length} storefronts; future purchases only)`
      )
      if (this.reporter.command === 'prices-plan') {
        const includedPoints = new Map(
          currentResponse.included
            .filter((item) => item.type === 'inAppPurchasePricePoints')
            .map((item) => [item.id, item as JsonApiResource<PricePointAttributes>])
        )
        const currentByTerritory = new Map<string, JsonApiResource<PricePointAttributes>>()
        for (const price of currentPrices) {
          const relationship = price.relationships?.inAppPurchasePricePoint?.data
          const identifier = Array.isArray(relationship) ? relationship[0] : relationship
          const point = identifier ? includedPoints.get(identifier.id) : undefined
          const territoryRelationship =
            price.relationships?.territory?.data ?? point?.relationships?.territory?.data
          const territory = Array.isArray(territoryRelationship)
            ? territoryRelationship[0]
            : territoryRelationship
          if (territory && point) currentByTerritory.set(territory.id, point)
        }
        for (const target of targets) {
          const existing = currentByTerritory.get(target.territoryId)
          if (existing?.id === target.point.id) continue
          this.reporter.info(
            `${target.territoryId}: ${existing?.attributes.customerPrice ?? 'missing'} → ${target.point.attributes.customerPrice}; ` +
              `source ${target.sourceYear ?? 'none'}, ratio ${target.rawRatio?.toFixed(3) ?? 'unavailable'}, band ${target.multiplier}, ` +
              `anchor $${adjustedPriceUsd(this.config.products.lifetime.priceUsd, target.multiplier)}, ${target.fallback ? '1.0 fallback' : 'automatic/override'}, future purchases only`
          )
        }
      }
      return
    }

    const included = targets.map((target, index) => ({
      type: 'inAppPurchasePrices',
      id: `\${price${index + 1}}`,
      attributes: { startDate: null },
      relationships: {
        inAppPurchaseV2: { data: { type: 'inAppPurchases', id: purchaseId } },
        inAppPurchasePricePoint: {
          data: { type: 'inAppPurchasePricePoints', id: target.point.id },
        },
      },
    }))

    await this.request('/v1/inAppPurchasePriceSchedules', {
      method: 'POST',
      body: {
        data: {
          type: 'inAppPurchasePriceSchedules',
          relationships: {
            inAppPurchase: { data: { type: 'inAppPurchases', id: purchaseId } },
            baseTerritory: {
              data: { type: 'territories', id: this.config.apple.baseTerritory },
            },
            manualPrices: {
              data: included.map(({ type, id }) => ({ type, id })),
            },
          },
        },
        included,
      },
    })
    this.reporter.change(
      `${laterChange ? 'replaced' : 'configured'} Apple lifetime regional price schedule (${targets.length} storefronts; future purchases only)`
    )
  }
}
