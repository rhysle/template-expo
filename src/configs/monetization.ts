import type { MonetizationConfig } from '../../scripts/monetization/types'

/**
 * Store-product catalog for a product fork.
 *
 * Keep this file free of credentials. Select only the products the app sells;
 * disabled products are not created or attached to RevenueCat. Each
 * appleProductId is a stable suffix; the provisioning script prefixes it with
 * the iOS bundle identifier from app.json.
 */
export const monetizationConfig = {
  enabledProducts: ['weekly', 'yearly', 'lifetime'],

  // Set to null to disable trials. Change target to move the one cross-store
  // trial to another enabled subscription, or use e.g. '7-days' for one week.
  freeTrial: {
    target: 'weekly',
    duration: '3-days',
  },

  stores: {
    apple: true,
    google: true,
    revenueCat: true,
  },

  regionalPricing: {
    strategy: 'ppp-bands',
    dataset: 'world-bank-2025',
    bands: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2],
    countryOverrides: {
      GI: 0.9, // Gibraltar
      LI: 1.0, // Liechtenstein
      MC: 1.0, // Monaco
      MM: 0.4, // Myanmar
      TW: 0.5, // Taiwan
      VA: 0.7, // Vatican City
      VG: 1.0, // British Virgin Islands
      ER: 0.4, // Eritrea
      GN: 0.4, // Guinea
      SO: 0.4, // Somalia
      TM: 0.5, // Turkmenistan
      VE: 0.4, // Venezuela
      YE: 0.4, // Yemen
    },
  },

  products: {
    weekly: {
      priceUsd: '3.99',
      referenceName: 'Premium Weekly',
      appleProductId: 'premium_weekly',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.png',
      googleBasePlanId: 'weekly',
      revenueCatPackageLookupKey: '$rc_weekly',
    },
    // Available for future forks; add 'monthly' to enabledProducts to provision it.
    monthly: {
      priceUsd: '9.99',
      referenceName: 'Premium Monthly',
      appleProductId: 'premium_monthly',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.png',
      googleBasePlanId: 'monthly',
      revenueCatPackageLookupKey: '$rc_monthly',
    },
    yearly: {
      priceUsd: '29.99',
      referenceName: 'Premium Yearly',
      appleProductId: 'premium_yearly',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.png',
      googleBasePlanId: 'yearly',
      revenueCatPackageLookupKey: '$rc_annual',
    },
    lifetime: {
      priceUsd: '79.99',
      referenceName: 'Premium Lifetime',
      appleProductId: 'premium_lifetime',
      appleReviewScreenshotPath: './fastlane/monetization/review/paywall.png',
      googleProductId: 'premium_lifetime',
      googlePurchaseOptionId: 'buy',
      revenueCatPackageLookupKey: '$rc_lifetime',
    },
  },

  apple: {
    subscriptionGroupReferenceName: 'Premium',
    baseTerritory: 'USA',
    familySharable: false,
    reviewNote: '',
  },

  google: {
    subscriptionProductId: 'premium',
    // Kept outside nullable freeTrial so a previously activated offer can still
    // be identified and deactivated when freeTrial is set to null.
    freeTrialOfferId: 'free-trial',
  },

  revenueCat: {
    entitlementLookupKey: 'premium',
    entitlementDisplayName: 'Premium',
    offeringLookupKey: 'default',
    offeringDisplayName: 'Default Offering',
    makeOfferingCurrent: true,
  },
} as const satisfies MonetizationConfig
