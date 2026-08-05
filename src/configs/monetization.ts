import type { MonetizationConfig } from '../../scripts/monetization/types'

/**
 * Store-product catalog for a product fork.
 *
 * Keep this file free of credentials. Select only the products the app sells;
 * disabled products are not created or attached to RevenueCat.
 */
export const monetizationConfig = {
  enabledProducts: ['weekly', 'yearly', 'lifetime'],

  stores: {
    apple: true,
    google: true,
    revenueCat: true,
  },

  products: {
    weekly: {
      priceUsd: '3.99',
      referenceName: 'Premium Weekly',
      displayName: 'Premium Weekly',
      description: 'Weekly access to all premium features.',
      appleProductId: 'premium_weekly',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.png',
      googleBasePlanId: 'weekly',
      revenueCatPackageLookupKey: '$rc_weekly',
    },
    // Available for future forks; add 'monthly' to enabledProducts to provision it.
    monthly: {
      priceUsd: '9.99',
      referenceName: 'Premium Monthly',
      displayName: 'Premium Monthly',
      description: 'Monthly access to all premium features.',
      appleProductId: 'premium_monthly',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.png',
      googleBasePlanId: 'monthly',
      revenueCatPackageLookupKey: '$rc_monthly',
    },
    yearly: {
      priceUsd: '29.99',
      referenceName: 'Premium Yearly',
      displayName: 'Premium Yearly',
      description: 'Yearly access to all premium features.',
      appleProductId: 'premium_yearly',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.png',
      googleBasePlanId: 'yearly',
      revenueCatPackageLookupKey: '$rc_annual',
    },
    lifetime: {
      priceUsd: '59.99',
      referenceName: 'Premium Lifetime',
      displayName: 'Premium Lifetime',
      description: 'Lifetime access to all premium features.',
      appleProductId: 'premium_lifetime',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.png',
      googleProductId: 'premium_lifetime',
      googlePurchaseOptionId: 'buy',
      revenueCatPackageLookupKey: '$rc_lifetime',
    },
  },

  // Store localizations are derived from the app's translated paywall strings.
  // English uses the explicit names/descriptions above as the canonical fallback.
  localization: {
    sourceDirectory: './src/i18n/locales',
    sourceLocale: 'en',
  },

  apple: {
    subscriptionGroupReferenceName: 'Premium',
    subscriptionGroupDisplayName: 'Premium',
    baseTerritory: 'USA',
    locale: 'en-US',
    familySharable: false,
    reviewNote: 'Unlocks all premium features in the app.',
  },

  google: {
    subscriptionProductId: 'premium',
    subscriptionTitle: 'Premium',
    subscriptionDescription: 'Unlock all premium features.',
    subscriptionBenefits: ['Access all premium features'],
    locale: 'en-US',
  },

  revenueCat: {
    entitlementLookupKey: 'premium',
    entitlementDisplayName: 'Premium',
    offeringLookupKey: 'default',
    offeringDisplayName: 'Default Offering',
    makeOfferingCurrent: true,
  },
} as const satisfies MonetizationConfig
