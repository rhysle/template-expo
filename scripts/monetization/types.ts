export type ProductKey = 'weekly' | 'monthly' | 'yearly' | 'lifetime'
export type SubscriptionProductKey = Exclude<ProductKey, 'lifetime'>
export type Command = 'plan' | 'apply' | 'verify' | 'activate'
export type FreeTrialDuration =
  '3-days' | '7-days' | '14-days' | '1-month' | '2-months' | '3-months' | '6-months' | '1-year'

export interface FreeTrialConfig {
  target: SubscriptionProductKey
  duration: FreeTrialDuration
  googleOfferId: string
}

export interface SubscriptionProductConfig {
  priceUsd: string
  referenceName: string
  displayName: string
  description: string
  appleProductId: string
  appleReviewScreenshotPath?: string
  googleBasePlanId: string
  revenueCatPackageLookupKey: string
}

export interface LifetimeProductConfig {
  priceUsd: string
  referenceName: string
  displayName: string
  description: string
  appleProductId: string
  appleReviewScreenshotPath?: string
  googleProductId: string
  googlePurchaseOptionId: string
  revenueCatPackageLookupKey: string
}

export interface MonetizationConfig {
  enabledProducts: readonly ProductKey[]
  freeTrial: FreeTrialConfig | null
  stores: {
    apple: boolean
    google: boolean
    revenueCat: boolean
  }
  products: {
    weekly: SubscriptionProductConfig
    monthly: SubscriptionProductConfig
    yearly: SubscriptionProductConfig
    lifetime: LifetimeProductConfig
  }
  localization: {
    sourceDirectory: string
    sourceLocale: string
  }
  apple: {
    subscriptionGroupReferenceName: string
    subscriptionGroupDisplayName: string
    baseTerritory: string
    locale: string
    familySharable: boolean
    reviewNote: string
  }
  google: {
    subscriptionProductId: string
    subscriptionTitle: string
    subscriptionDescription: string
    subscriptionBenefits: readonly string[]
    locale: string
  }
  revenueCat: {
    entitlementLookupKey: string
    entitlementDisplayName: string
    offeringLookupKey: string
    offeringDisplayName: string
    makeOfferingCurrent: boolean
  }
}

export interface ProductStoreLocalization {
  displayName: string
  description: string
}

export interface StoreLocalization {
  sourceLocale: string
  appleLocale: string
  googleLocale: string
  subscriptionGroupDisplayName: string
  subscriptionTitle: string
  subscriptionDescription: string
  subscriptionBenefits: string[]
  products: Record<ProductKey, ProductStoreLocalization>
}

export interface StoreEnvironment {
  appName: string
  apple?: {
    bundleIdentifier: string
    issuerId: string
    keyId: string
    keyFilepath: string
  }
  google?: {
    packageName: string
    jsonKeyPath: string
  }
  revenueCat?: {
    projectId: string
    bundleIdentifier?: string
    packageName?: string
    apiKey: string
  }
}

export interface JsonApiResource<Attributes = Record<string, unknown>> {
  id: string
  type: string
  attributes: Attributes
  relationships?: Record<string, { data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] }>
}

export interface AppleUploadOperation {
  method: string
  url: string
  length: number
  offset: number
  requestHeaders: Array<{ name: string; value: string }>
}

export interface JsonApiResourceIdentifier {
  id: string
  type: string
}

export interface JsonApiListResponse<T> {
  data: T[]
  included?: JsonApiResource[]
  links?: { next?: string }
}

export interface JsonApiSingleResponse<T> {
  data: T
  included?: JsonApiResource[]
}

export interface GoogleMoney {
  currencyCode: string
  units?: string
  nanos?: number
}

export interface GoogleConvertedPrice {
  regionCode: string
  price: GoogleMoney
}

export interface GoogleConvertedPrices {
  convertedRegionPrices: Record<string, GoogleConvertedPrice>
  convertedOtherRegionsPrice: {
    usdPrice: GoogleMoney
    eurPrice: GoogleMoney
  }
  regionVersion: { version: string }
}
