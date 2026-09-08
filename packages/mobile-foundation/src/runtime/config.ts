export interface FoundationConfig {
  iosAppStoreId: string
  support: { email: string }
  links: { termsOfService: string; privacyPolicy: string }
  otaUpdate: { enabled: boolean }
  appReview: { minActionsBeforeRequest: number; minDaysBetweenRequests: number }
  autoPaywall: { intervalDays: number }
  revenueCat: {
    testStoreApiKey: string
    iosApiKey: string
    androidApiKey: string
    entitlementId: string
  }
  sentry: { dsn: string }
  ads: {
    enabled: boolean
    banner: { enabled: boolean }
    ios: { appId: string; bannerAdUnitId: string; interstitialAdUnitId: string }
    android: { appId: string; bannerAdUnitId: string; interstitialAdUnitId: string }
    interstitial: {
      enabled: boolean
      initialGraceCompletions: number
      completionsBetweenAds: number
      cooldownMs: number
    }
  }
}
