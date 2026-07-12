export const AppConfig = {
  iosAppStoreId: '', // Set your iOS App Store ID here (e.g., '1234567890')
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
    iosApiKey: '',
    androidApiKey: '',
    entitlementId: 'premium',
  },
  sentry: {
    dsn: '',
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
      gracePeriodSessions: 3,
      cooldownMs: 4 * 60 * 60 * 1000, // 4 hours
    },
  },
} as const
