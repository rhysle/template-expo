// App-owned configuration. Run setup commands before release.
export const AppConfig = {
  iosAppStoreId: '',
  support: {
    email: 'support@rhysle.com',
  },
  links: {
    termsOfService: 'https://rhysle.com/terms/',
    privacyPolicy: 'https://rhysle.com/privacy/',
  },
  otaUpdate: {
    enabled: false,
  },
  appReview: {
    minActionsBeforeRequest: 1,
    minDaysBetweenRequests: 30,
  },
  autoPaywall: {
    intervalDays: 7,
  },
  revenueCat: {
    testStoreApiKey: '',
    iosApiKey: '',
    androidApiKey: '',
    entitlementId: 'premium',
  },
  sentry: {
    dsn: '',
  },
  ads: {
    enabled: false,
    banner: {
      enabled: true,
    },
    ios: {
      appId: '',
      bannerAdUnitId: '',
      interstitialAdUnitId: '',
    },
    android: {
      appId: '',
      bannerAdUnitId: '',
      interstitialAdUnitId: '',
    },
    interstitial: {
      enabled: true,
      initialGraceCompletions: 2,
      completionsBetweenAds: 2,
      cooldownMs: 86400000,
    },
  },
} as const
