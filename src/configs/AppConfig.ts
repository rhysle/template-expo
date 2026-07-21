export const AppConfig = {
  iosAppStoreId: '6790683139', // Set your iOS App Store ID here (e.g., '1234567890')
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
    minActionsBeforeRequest: 1,
    minDaysBetweenRequests: 30,
  },
  autoPaywall: {
    intervalDays: 7,
  },
  revenueCat: {
    iosApiKey: 'test_gnTMNDOnGFGsGAETdCbmbZggLTD',
    androidApiKey: 'test_gnTMNDOnGFGsGAETdCbmbZggLTD',
    entitlementId: 'premium',
  },
  sentry: {
    dsn: 'https://824c1df7aa59cca914eb2a983313744f@o4511059508461568.ingest.us.sentry.io/4511722544431104',
  },
  ads: {
    /**
     * Set to true to activate the ads subsystem.
     * Also requires react-native-google-mobile-ads to be installed
     * and the app.json plugin to be configured (see AGENTS.md).
     * bannerAdUnitId and interstitialAdUnitId should be set to
     * real ad unit IDs from AdMob for production builds.
     */
    enabled: false,
    ios: {
      appId: 'ca-app-pub-4662625232077043~6949204305',
      bannerAdUnitId: '',
      interstitialAdUnitId: '',
    },
    android: {
      appId: 'ca-app-pub-4662625232077043~8614004722',
      bannerAdUnitId: '',
      interstitialAdUnitId: '',
    },
    interstitial: {
      gracePeriodSessions: 3,
      cooldownMs: 4 * 60 * 60 * 1000, // 4 hours
    },
  },
} as const
