// App-owned configuration. Run setup commands before release.
export const AppConfig = {
  iosAppStoreId: '6799632468',
  support: {
    email: 'support@rhysle.com',
  },
  links: {
    termsOfService: 'https://rhysle.com/terms/',
    privacyPolicy: 'https://rhysle.com/privacy/',
  },
  otaUpdate: {
    enabled: true,
  },
  appReview: {
    minActionsBeforeRequest: 1,
    minDaysBetweenRequests: 30,
  },
  autoPaywall: {
    intervalDays: 7,
  },
  revenueCat: {
    testStoreApiKey: 'test_xLandgMKhgxlXyVVKZhbUgccdut',
    iosApiKey: 'appl_MiMXfSQYeWLJkyaICfOJolXZFrA',
    androidApiKey: 'goog_yOuzScOUnioGlJumQRZrIJvyaBm',
    entitlementId: 'premium',
  },
  sentry: {
    dsn: 'https://2b26deff0a1f934872e39cce27cee20c@o4511059508461568.ingest.us.sentry.io/4512096442318848',
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
