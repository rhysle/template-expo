export const AppConfig = {
  iosAppStoreId: '6799632468', // Set your iOS App Store ID here (e.g., '1234567890')
  support: {
    email: 'support@rhysle.com',
  },
  links: {
    termsOfService: 'https://rhysle.com/terms/',
    privacyPolicy: 'https://rhysle.com/privacy/',
  },
  otaUpdate: {
    /**
     * Set to false to disable OTA update checks entirely.
     * Useful during QA when you want predictable builds.
     * In dev mode, checks are always skipped regardless of this flag.
     */
    enabled: true,
  },
  appReview: {
    minActionsBeforeRequest: 2,
    minDaysBetweenRequests: 30,
  },
  autoPaywall: {
    intervalDays: 7,
  },
  revenueCat: {
    testStoreApiKey: 'test_gnTMNDOnGFGsGAETdCbmbZggLTD',
    iosApiKey: 'appl_NrETpPZkABRMOQQVYTPfgQBmHVP',
    androidApiKey: 'goog_eAneirqJQripNGrjTeTIrDqHbpo',
    entitlementId: 'premium',
  },
  sentry: {
    dsn: 'https://5f6bd6fc3274b224f5e082930b7283a4@o4511059508461568.ingest.us.sentry.io/4511881188212736',
  },
  ads: {
    /**
     * Set to true to activate the ads subsystem.
     * Also requires react-native-google-mobile-ads to be installed
     * and the app.json plugin to be configured (see AGENTS.md).
     * bannerAdUnitId and interstitialAdUnitId should be set to
     * real ad unit IDs from AdMob for production builds.
     */
    enabled: true,
    banner: {
      enabled: true,
    },
    ios: {
      appId: 'ca-app-pub-4662625232077043~6468386134',
      bannerAdUnitId: 'ca-app-pub-4662625232077043/2733738416',
      interstitialAdUnitId: 'ca-app-pub-4662625232077043/6530493132',
    },
    android: {
      appId: 'ca-app-pub-4662625232077043~6286804764',
      bannerAdUnitId: 'ca-app-pub-4662625232077043/7771276829',
      interstitialAdUnitId: 'ca-app-pub-4662625232077043/1469738148',
    },
    interstitial: {
      enabled: true,
      initialGraceCompletions: 2,
      completionsBetweenAds: 2,
      cooldownMs: 24 * 60 * 60 * 1000, // 24 hours
    },
  },
} as const
