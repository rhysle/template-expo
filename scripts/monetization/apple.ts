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

const SUBSCRIPTION_PERIOD: Record<SubscriptionProductKey, string> = {
  weekly: 'ONE_WEEK',
  monthly: 'ONE_MONTH',
  yearly: 'ONE_YEAR',
}
const SUBSCRIPTION_KEYS: SubscriptionProductKey[] = ['weekly', 'monthly', 'yearly']
const SUBSCRIPTION_PLAN_TYPE = 'UPFRONT' as const

const today = (): string => new Date().toISOString().slice(0, 10)
const pricesEqual = (left: string, right: string): boolean => Number(left) === Number(right)

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

export class AppleStoreClient {
  private readonly auth: AppleAuth
  private readonly metadata: AppleMetadataReconciler
  private appId: string | undefined
  private territoryIdentifiers: Array<{ type: 'territories'; id: string }> | undefined

  constructor(
    private readonly config: MonetizationConfig,
    private readonly environment: NonNullable<StoreEnvironment['apple']>,
    private readonly reporter: Reporter,
    private readonly requestOverride?: JsonRequester
  ) {
    this.auth = new AppleAuth(environment.issuerId, environment.keyId, environment.keyFilepath)
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
                availableTerritories: {
                  data: await this.allTerritoryIdentifiers(),
                },
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

  private async getSubscriptionPrice(
    subscriptionId: string
  ): Promise<JsonApiResource<PricePointAttributes> | undefined> {
    const url = appendQuery(`${API_ROOT}/v1/subscriptions/${subscriptionId}/prices`, {
      'filter[territory]': this.config.apple.baseTerritory,
      include: 'subscriptionPricePoint',
      limit: 200,
    })
    const response =
      await this.request<JsonApiListResponse<JsonApiResource<{ startDate?: string | null }>>>(url)
    if (!response || response.data.length === 0) return undefined

    const current = response.data
      .filter((item) => item.attributes.startDate == null || item.attributes.startDate <= today())
      .sort((left, right) =>
        String(left.attributes.startDate ?? '').localeCompare(
          String(right.attributes.startDate ?? '')
        )
      )
      .at(-1)
    const pricePointId = current?.relationships?.subscriptionPricePoint?.data
    const identifier = Array.isArray(pricePointId) ? pricePointId[0] : pricePointId
    return response.included?.find(
      (item): item is JsonApiResource<PricePointAttributes> =>
        item.type === 'subscriptionPricePoints' && item.id === identifier?.id
    )
  }

  private async ensureSubscriptionPrice(
    subscriptionId: string,
    key: SubscriptionProductKey
  ): Promise<void> {
    const desired = this.config.products[key]
    const current = await this.getSubscriptionPrice(subscriptionId)
    if (current) {
      if (!pricesEqual(current.attributes.customerPrice, desired.priceUsd)) {
        this.reporter.error(
          `Apple ${key} already has US price $${current.attributes.customerPrice}; initial setup will not change it to $${desired.priceUsd}`
        )
        return
      }
      this.reporter.ok(`Apple ${key} US price is $${desired.priceUsd}`)
    }

    if (!current && this.reporter.command !== 'apply') {
      if (this.reporter.command === 'verify') {
        this.reporter.error(`Missing: Apple ${key} initial storefront prices`)
      } else {
        this.reporter.change(`configure Apple ${key} initial storefront prices`)
      }
      return
    }

    const basePricePoint = await this.findSubscriptionPricePoint(subscriptionId, desired.priceUsd)
    const equalizations = await this.listAll<JsonApiResource<PricePointAttributes>>(
      appendQuery(`${API_ROOT}/v1/subscriptionPricePoints/${basePricePoint.id}/equalizations`, {
        limit: 200,
      })
    )
    const targetPoints = [basePricePoint, ...equalizations]
    const existingPrices = await this.listAll<JsonApiResource<{ startDate?: string | null }>>(
      appendQuery(`${API_ROOT}/v1/subscriptions/${subscriptionId}/prices`, { limit: 200 })
    )
    const existingPointIds = new Set(
      existingPrices.flatMap((item) => {
        const data = item.relationships?.subscriptionPricePoint?.data
        const identifiers = Array.isArray(data) ? data : data ? [data] : []
        return identifiers.map((identifier) => identifier.id)
      })
    )
    const missingPoints = targetPoints.filter((point) => !existingPointIds.has(point.id))

    if (missingPoints.length === 0 || existingPrices.length >= targetPoints.length) {
      this.reporter.ok(`Apple ${key} prices cover all storefronts`)
      return
    }

    if (this.reporter.command === 'verify') {
      this.reporter.error(`Missing: Apple ${key} prices in ${missingPoints.length} storefront(s)`)
      return
    }
    if (this.reporter.command === 'plan') {
      this.reporter.change(
        `configure Apple ${key} prices in ${missingPoints.length} missing storefront(s)`
      )
      return
    }

    await runWithConcurrency(missingPoints, 5, async (pricePoint) => {
      await this.request('/v1/subscriptionPrices', {
        method: 'POST',
        body: {
          data: {
            type: 'subscriptionPrices',
            attributes: {
              startDate: null,
              planType: SUBSCRIPTION_PLAN_TYPE,
            },
            relationships: {
              subscription: { data: { type: 'subscriptions', id: subscriptionId } },
              subscriptionPricePoint: {
                data: { type: 'subscriptionPricePoints', id: pricePoint.id },
              },
            },
          },
        },
      })
    })
    this.reporter.change(
      `configured Apple ${key} initial prices in ${missingPoints.length} storefront(s)`
    )
  }

  private async findSubscriptionPricePoint(
    subscriptionId: string,
    priceUsd: string
  ): Promise<JsonApiResource<PricePointAttributes>> {
    const points = await this.listAll<JsonApiResource<PricePointAttributes>>(
      appendQuery(`${API_ROOT}/v1/subscriptions/${subscriptionId}/pricePoints`, {
        'filter[territory]': this.config.apple.baseTerritory,
        limit: 200,
      })
    )
    const point = points.find((item) => pricesEqual(item.attributes.customerPrice, priceUsd))
    if (!point) {
      throw new Error(
        `Apple has no ${this.config.apple.baseTerritory} subscription price point for $${priceUsd}`
      )
    }
    return point
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

    await this.reporter.ensure(
      'Apple lifetime availability in all storefronts',
      current,
      async () => {
        const created = await this.request<
          JsonApiSingleResponse<JsonApiResource<InAppPurchaseAvailabilityAttributes>>
        >('/v1/inAppPurchaseAvailabilities', {
          method: 'POST',
          body: {
            data: {
              type: 'inAppPurchaseAvailabilities',
              attributes: { availableInNewTerritories: true },
              relationships: {
                availableTerritories: {
                  data: await this.allTerritoryIdentifiers(),
                },
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
    )
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

  private async getLifetimePrice(
    purchaseId: string
  ): Promise<JsonApiResource<PricePointAttributes> | undefined> {
    const schedule = await this.request<JsonApiSingleResponse<JsonApiResource>>(
      `/v2/inAppPurchases/${purchaseId}/iapPriceSchedule`,
      { allowNotFound: true }
    )
    if (!schedule) return undefined

    const response = await this.request<
      JsonApiListResponse<JsonApiResource<{ startDate?: string | null }>>
    >(
      appendQuery(`${API_ROOT}/v1/inAppPurchasePriceSchedules/${schedule.data.id}/manualPrices`, {
        'filter[territory]': this.config.apple.baseTerritory,
        include: 'inAppPurchasePricePoint',
        limit: 200,
      })
    )
    if (!response || response.data.length === 0) return undefined
    const current =
      response.data.find((item) => item.attributes.startDate == null) ?? response.data.at(-1)
    const relationship = current?.relationships?.inAppPurchasePricePoint?.data
    const identifier = Array.isArray(relationship) ? relationship[0] : relationship
    return response.included?.find(
      (item): item is JsonApiResource<PricePointAttributes> =>
        item.type === 'inAppPurchasePricePoints' && item.id === identifier?.id
    )
  }

  private async ensureLifetimePrice(purchaseId: string): Promise<void> {
    const desired = this.config.products.lifetime
    const current = await this.getLifetimePrice(purchaseId)
    if (current) {
      if (pricesEqual(current.attributes.customerPrice, desired.priceUsd)) {
        this.reporter.ok(`Apple lifetime US price is $${desired.priceUsd}`)
      } else {
        this.reporter.error(
          `Apple lifetime already has US price $${current.attributes.customerPrice}; initial setup will not change it to $${desired.priceUsd}`
        )
      }
      return
    }

    if (this.reporter.command !== 'apply') {
      if (this.reporter.command === 'verify') {
        this.reporter.error('Missing: Apple lifetime initial price')
      } else {
        this.reporter.change('configure Apple lifetime initial price')
      }
      return
    }

    const points = await this.listAll<JsonApiResource<PricePointAttributes>>(
      appendQuery(`${API_ROOT}/v2/inAppPurchases/${purchaseId}/pricePoints`, {
        'filter[territory]': this.config.apple.baseTerritory,
        limit: 200,
      })
    )
    const pricePoint = points.find((item) =>
      pricesEqual(item.attributes.customerPrice, desired.priceUsd)
    )
    if (!pricePoint) {
      throw new Error(
        `Apple has no ${this.config.apple.baseTerritory} lifetime price point for $${desired.priceUsd}`
      )
    }

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
              data: [{ type: 'inAppPurchasePrices', id: '${price1}' }],
            },
          },
        },
        included: [
          {
            type: 'inAppPurchasePrices',
            id: '${price1}',
            attributes: { startDate: null },
            relationships: {
              inAppPurchaseV2: { data: { type: 'inAppPurchases', id: purchaseId } },
              inAppPurchasePricePoint: {
                data: { type: 'inAppPurchasePricePoints', id: pricePoint.id },
              },
            },
          },
        ],
      },
    })
    this.reporter.change('configured Apple lifetime base price with automatic equalization')
  }
}
