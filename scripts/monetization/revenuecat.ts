import { enabledSubscriptionKeys, isEnabled } from './config'
import { requestJson } from './http'
import { Reporter } from './reporter'
import type { MonetizationConfig, ProductKey, StoreEnvironment } from './types'

const API_ROOT = 'https://api.revenuecat.com/v2'

interface RevenueCatList<T> {
  items: T[]
  next_page?: string | null
}

interface RevenueCatProduct {
  id: string
  app_id: string
  store_identifier: string
  type: string
  display_name?: string | null
}

interface RevenueCatApp {
  id: string
  name: string
  type: string
  app_store?: { bundle_id?: string | null }
  play_store?: { package_name?: string | null }
}

interface ResolvedRevenueCatApps {
  appleAppId?: string
  googleAppId?: string
}

interface RevenueCatEntitlement {
  id: string
  lookup_key: string
  display_name: string
}

interface RevenueCatOffering {
  id: string
  lookup_key: string
  display_name: string
  is_current: boolean
}

interface RevenueCatPackage {
  id: string
  lookup_key: string
  display_name: string
  position: number
}

interface RevenueCatProductLink {
  product?: RevenueCatProduct
  id?: string
}

interface DesiredRevenueCatProduct {
  logicalKey: ProductKey
  appId: string
  storeIdentifier: string
  type: 'subscription' | 'non_consumable'
  displayName: string
}

export class RevenueCatClient {
  constructor(
    private readonly config: MonetizationConfig,
    private readonly environment: NonNullable<StoreEnvironment['revenueCat']>,
    private readonly reporter: Reporter
  ) {}

  private async request<T>(
    pathOrUrl: string,
    options: Parameters<typeof requestJson<T>>[1] = {}
  ): Promise<T | undefined> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_ROOT}${pathOrUrl}`
    return requestJson<T>(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.environment.apiKey}`,
        ...options.headers,
      },
    })
  }

  private async listAll<T>(pathOrUrl: string): Promise<T[]> {
    const items: T[] = []
    let next: string | undefined = pathOrUrl

    while (next) {
      const response: RevenueCatList<T> | undefined = await this.request(next)
      if (!response) break
      items.push(...response.items)
      next = response.next_page
        ? response.next_page.startsWith('http')
          ? response.next_page
          : new URL(response.next_page, 'https://api.revenuecat.com').toString()
        : undefined
    }
    return items
  }

  async sync(): Promise<void> {
    this.reporter.section('RevenueCat')
    const apps = await this.resolveApps()
    const products = await this.syncProducts(apps)
    await this.syncEntitlement(products)
    await this.syncOffering(products, apps)
  }

  private async resolveApps(): Promise<ResolvedRevenueCatApps> {
    const apps = await this.listAll<RevenueCatApp>(
      `/projects/${this.environment.projectId}/apps?limit=100`
    )
    const resolved: ResolvedRevenueCatApps = {}

    if (this.config.stores.apple) {
      const bundleIdentifier = this.environment.bundleIdentifier
      if (!bundleIdentifier) {
        throw new Error('Missing iOS bundle identifier from app.json for RevenueCat discovery')
      }
      const matches = apps.filter(
        (app) => app.type === 'app_store' && app.app_store?.bundle_id === bundleIdentifier
      )
      resolved.appleAppId = this.resolveSingleApp(
        matches,
        'App Store',
        'bundle ID',
        bundleIdentifier
      )
      this.reporter.ok(`RevenueCat App Store app for ${bundleIdentifier}`)
    }

    if (this.config.stores.google) {
      const packageName = this.environment.packageName
      if (!packageName) {
        throw new Error('Missing Android package name from app.json for RevenueCat discovery')
      }
      const matches = apps.filter(
        (app) => app.type === 'play_store' && app.play_store?.package_name === packageName
      )
      resolved.googleAppId = this.resolveSingleApp(
        matches,
        'Google Play',
        'package name',
        packageName
      )
      this.reporter.ok(`RevenueCat Google Play app for ${packageName}`)
    }

    return resolved
  }

  private resolveSingleApp(
    matches: RevenueCatApp[],
    storeName: string,
    identifierLabel: string,
    identifier: string
  ): string {
    if (matches.length === 0) {
      throw new Error(
        `No RevenueCat ${storeName} app found with ${identifierLabel} ${identifier} in project ${this.environment.projectId}. Create the app record in RevenueCat or correct app.json.`
      )
    }
    if (matches.length > 1) {
      const details = matches.map((app) => `${app.name} (${app.id})`).join(', ')
      throw new Error(
        `Multiple RevenueCat ${storeName} apps match ${identifierLabel} ${identifier}: ${details}`
      )
    }
    return matches[0].id
  }

  private desiredProducts(apps: ResolvedRevenueCatApps): DesiredRevenueCatProduct[] {
    const desired: DesiredRevenueCatProduct[] = []
    const subscriptionKeys = enabledSubscriptionKeys(this.config)

    for (const key of subscriptionKeys) {
      const product = this.config.products[key]
      if (this.config.stores.apple && apps.appleAppId) {
        desired.push({
          logicalKey: key,
          appId: apps.appleAppId,
          storeIdentifier: product.appleProductId,
          type: 'subscription',
          displayName: `${product.referenceName} (App Store)`,
        })
      }
      if (this.config.stores.google && apps.googleAppId) {
        desired.push({
          logicalKey: key,
          appId: apps.googleAppId,
          storeIdentifier: `${this.config.google.subscriptionProductId}:${product.googleBasePlanId}`,
          type: 'subscription',
          displayName: `${product.referenceName} (Google Play)`,
        })
      }
    }

    if (isEnabled('lifetime', this.config)) {
      const product = this.config.products.lifetime
      if (this.config.stores.apple && apps.appleAppId) {
        desired.push({
          logicalKey: 'lifetime',
          appId: apps.appleAppId,
          storeIdentifier: product.appleProductId,
          type: 'non_consumable',
          displayName: `${product.referenceName} (App Store)`,
        })
      }
      if (this.config.stores.google && apps.googleAppId) {
        desired.push({
          logicalKey: 'lifetime',
          appId: apps.googleAppId,
          storeIdentifier: product.googleProductId,
          type: 'non_consumable',
          displayName: `${product.referenceName} (Google Play)`,
        })
      }
    }

    return desired
  }

  private async syncProducts(
    apps: ResolvedRevenueCatApps
  ): Promise<Map<string, RevenueCatProduct>> {
    const projectId = this.environment.projectId
    const existing = await this.listAll<RevenueCatProduct>(
      `/projects/${projectId}/products?limit=100`
    )
    const resolved = new Map<string, RevenueCatProduct>()

    for (const desired of this.desiredProducts(apps)) {
      const key = `${desired.appId}:${desired.storeIdentifier}`
      let product = existing.find(
        (item) => item.app_id === desired.appId && item.store_identifier === desired.storeIdentifier
      )
      product = await this.reporter.ensure(
        `RevenueCat ${desired.displayName} product`,
        product,
        async () => {
          const created = await this.request<RevenueCatProduct>(`/projects/${projectId}/products`, {
            method: 'POST',
            body: {
              app_id: desired.appId,
              store_identifier: desired.storeIdentifier,
              type: desired.type,
              display_name: desired.displayName,
            },
          })
          if (!created) throw new Error(`RevenueCat did not return ${desired.displayName}`)
          return created
        }
      )
      if (product) resolved.set(key, product)
    }

    return resolved
  }

  private async syncEntitlement(products: Map<string, RevenueCatProduct>): Promise<void> {
    const projectId = this.environment.projectId
    const desired = this.config.revenueCat
    const entitlements = await this.listAll<RevenueCatEntitlement>(
      `/projects/${projectId}/entitlements?limit=100`
    )
    let entitlement = entitlements.find((item) => item.lookup_key === desired.entitlementLookupKey)
    entitlement = await this.reporter.ensure(
      'RevenueCat premium entitlement',
      entitlement,
      async () => {
        const created = await this.request<RevenueCatEntitlement>(
          `/projects/${projectId}/entitlements`,
          {
            method: 'POST',
            body: {
              lookup_key: desired.entitlementLookupKey,
              display_name: desired.entitlementDisplayName,
            },
          }
        )
        if (!created) throw new Error('RevenueCat did not return the premium entitlement')
        return created
      }
    )

    if (!entitlement) {
      this.reporter.change('attach enabled products to RevenueCat premium entitlement')
      return
    }

    const linked = await this.listAll<RevenueCatProductLink>(
      `/projects/${projectId}/entitlements/${entitlement.id}/products?limit=100`
    )
    const linkedIds = new Set(linked.map((item) => item.product?.id ?? item.id).filter(Boolean))
    const missing = [...products.values()].filter((product) => !linkedIds.has(product.id))
    if (missing.length === 0 && products.size > 0) {
      this.reporter.ok('RevenueCat enabled products attached to premium entitlement')
    } else if (this.reporter.command === 'apply' && missing.length > 0) {
      await this.request(
        `/projects/${projectId}/entitlements/${entitlement.id}/actions/attach_products`,
        {
          method: 'POST',
          body: { product_ids: missing.map((item) => item.id) },
        }
      )
      this.reporter.change(
        `attached ${missing.length} product(s) to RevenueCat premium entitlement`
      )
    } else if (this.reporter.command === 'verify') {
      if (products.size === 0) {
        this.reporter.error(
          'Cannot verify RevenueCat entitlement attachments: products are missing'
        )
      } else if (missing.length > 0) {
        this.reporter.error(
          `Missing: ${missing.length} RevenueCat product attachment(s) on premium entitlement`
        )
      }
    } else {
      this.reporter.change('attach enabled products to RevenueCat premium entitlement')
    }
  }

  private async syncOffering(
    products: Map<string, RevenueCatProduct>,
    apps: ResolvedRevenueCatApps
  ): Promise<void> {
    const projectId = this.environment.projectId
    const desired = this.config.revenueCat
    const offerings = await this.listAll<RevenueCatOffering>(
      `/projects/${projectId}/offerings?limit=100`
    )
    let offering = offerings.find((item) => item.lookup_key === desired.offeringLookupKey)
    offering = await this.reporter.ensure('RevenueCat default offering', offering, async () => {
      const created = await this.request<RevenueCatOffering>(`/projects/${projectId}/offerings`, {
        method: 'POST',
        body: {
          lookup_key: desired.offeringLookupKey,
          display_name: desired.offeringDisplayName,
        },
      })
      if (!created) throw new Error('RevenueCat did not return the default offering')
      return created
    })

    if (!offering) {
      for (const key of this.config.enabledProducts) {
        this.reporter.change(`create and populate RevenueCat ${key} package`)
      }
      return
    }

    if (desired.makeOfferingCurrent && !offering.is_current) {
      if (this.reporter.command === 'apply') {
        const updated = await this.request<RevenueCatOffering>(
          `/projects/${projectId}/offerings/${offering.id}`,
          { method: 'POST', body: { is_current: true } }
        )
        if (!updated) throw new Error('RevenueCat did not return the updated default offering')
        offering = updated
        this.reporter.change('set RevenueCat default offering as current')
      } else if (this.reporter.command === 'verify') {
        this.reporter.error('RevenueCat default offering is not current')
      } else {
        this.reporter.change('set RevenueCat default offering as current')
      }
    } else if (desired.makeOfferingCurrent) {
      this.reporter.ok('RevenueCat default offering is current')
    }

    const packages = await this.listAll<RevenueCatPackage>(
      `/projects/${projectId}/offerings/${offering.id}/packages?limit=100`
    )
    for (const [index, key] of this.config.enabledProducts.entries()) {
      const productConfig = this.config.products[key]
      let packageItem = packages.find(
        (item) => item.lookup_key === productConfig.revenueCatPackageLookupKey
      )
      packageItem = await this.reporter.ensure(
        `RevenueCat ${key} package`,
        packageItem,
        async () => {
          const created = await this.request<RevenueCatPackage>(
            `/projects/${projectId}/offerings/${offering.id}/packages`,
            {
              method: 'POST',
              body: {
                lookup_key: productConfig.revenueCatPackageLookupKey,
                display_name: productConfig.referenceName,
                position: index + 1,
              },
            }
          )
          if (!created) throw new Error(`RevenueCat did not return the ${key} package`)
          return created
        }
      )

      if (!packageItem) {
        this.reporter.change(`attach Apple and Google ${key} products to RevenueCat package`)
        continue
      }
      await this.syncPackageProducts(packageItem, key, products, apps)
    }
  }

  private async syncPackageProducts(
    packageItem: RevenueCatPackage,
    key: ProductKey,
    products: Map<string, RevenueCatProduct>,
    apps: ResolvedRevenueCatApps
  ): Promise<void> {
    const projectId = this.environment.projectId
    const desiredProducts = this.desiredProducts(apps)
      .filter((item) => item.logicalKey === key)
      .map((item) => products.get(`${item.appId}:${item.storeIdentifier}`))
      .filter((item): item is RevenueCatProduct => Boolean(item))

    const linked = await this.listAll<RevenueCatProductLink>(
      `/projects/${projectId}/packages/${packageItem.id}/products?limit=100`
    )
    const linkedIds = new Set(linked.map((item) => item.product?.id ?? item.id).filter(Boolean))
    const missing = desiredProducts.filter((product) => !linkedIds.has(product.id))
    if (missing.length === 0 && desiredProducts.length > 0) {
      this.reporter.ok(`RevenueCat ${key} package products`)
    } else if (this.reporter.command === 'apply' && missing.length > 0) {
      await this.request(
        `/projects/${projectId}/packages/${packageItem.id}/actions/attach_products`,
        {
          method: 'POST',
          body: {
            products: missing.map((product) => ({
              product_id: product.id,
              eligibility_criteria: 'all',
            })),
          },
        }
      )
      this.reporter.change(`attached ${missing.length} product(s) to RevenueCat ${key} package`)
    } else if (this.reporter.command === 'verify') {
      this.reporter.error(`Missing: RevenueCat ${key} package product attachment(s)`)
    } else {
      this.reporter.change(`attach enabled products to RevenueCat ${key} package`)
    }
  }
}
