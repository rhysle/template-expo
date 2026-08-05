import type { MonetizationConfig } from '../../scripts/monetization/types'

/**
 * Store-product catalog for a product fork.
 *
 * Keep this file free of credentials. Select only the products the app sells;
 * disabled products are not created or attached to RevenueCat.
 */
export const monetizationConfig = {
  enabledProducts: ['weekly', 'yearly', 'lifetime'],

  // Set to null to disable trials. Change target to move the one cross-store
  // trial to another enabled subscription, or use e.g. '7-days' for one week.
  freeTrial: {
    target: 'weekly',
    duration: '3-days',
    googleOfferId: 'free-trial',
  },

  stores: {
    apple: true,
    google: true,
    revenueCat: true,
  },

  products: {
    weekly: {
      priceUsd: '3.99',
      referenceName: 'Premium Weekly',
      appleProductId: 'premium_weekly',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.PNG',
      googleBasePlanId: 'weekly',
      revenueCatPackageLookupKey: '$rc_weekly',
    },
    // Available for future forks; add 'monthly' to enabledProducts to provision it.
    monthly: {
      priceUsd: '9.99',
      referenceName: 'Premium Monthly',
      appleProductId: 'premium_monthly',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.PNG',
      googleBasePlanId: 'monthly',
      revenueCatPackageLookupKey: '$rc_monthly',
    },
    yearly: {
      priceUsd: '29.99',
      referenceName: 'Premium Yearly',
      appleProductId: 'premium_yearly',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.PNG',
      googleBasePlanId: 'yearly',
      revenueCatPackageLookupKey: '$rc_annual',
    },
    lifetime: {
      priceUsd: '59.99',
      referenceName: 'Premium Lifetime',
      appleProductId: 'premium_lifetime',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.PNG',
      googleProductId: 'premium_lifetime',
      googlePurchaseOptionId: 'buy',
      revenueCatPackageLookupKey: '$rc_lifetime',
    },
  },

  apple: {
    subscriptionGroupReferenceName: 'Premium',
    baseTerritory: 'USA',
    familySharable: false,
    reviewNote: 'Unlocks all premium features in the app.',
  },

  google: {
    subscriptionProductId: 'premium',
  },

  revenueCat: {
    entitlementLookupKey: 'premium',
    entitlementDisplayName: 'Premium',
    offeringLookupKey: 'default',
    offeringDisplayName: 'Default Offering',
    makeOfferingCurrent: true,
  },
} as const satisfies MonetizationConfig
