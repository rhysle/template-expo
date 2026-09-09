import type { CoreConfig } from '@shared/core/runtime/config'
import { recordError } from '@shared/core/services/sentry'
import { Platform } from 'react-native'
import MobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  BannerAdSize,
  InterstitialAd,
  MaxAdContentRating,
  TestIds,
} from 'react-native-google-mobile-ads'

// Re-export so consumers never import from the ad package directly.
export {
  AdEventType,
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  BannerAdSize,
  InterstitialAd,
  TestIds,
}

// ── Feature flag ──────────────────────────────────────────────────────────────

export const isAdsEnabled = (appConfig: CoreConfig): boolean => appConfig.ads.enabled
export const isBannerAdsEnabled = (appConfig: CoreConfig): boolean =>
  appConfig.ads.enabled && appConfig.ads.banner.enabled
export const isInterstitialAdsEnabled = (appConfig: CoreConfig): boolean =>
  appConfig.ads.enabled && appConfig.ads.interstitial.enabled
export const isAnyAdFormatEnabled = (appConfig: CoreConfig): boolean =>
  isBannerAdsEnabled(appConfig) || isInterstitialAdsEnabled(appConfig)

// ── Ad unit IDs ───────────────────────────────────────────────────────────────

export const getAdUnitId = (appConfig: CoreConfig, type: 'banner' | 'interstitial'): string => {
  if (!appConfig.ads.enabled || __DEV__) {
    const testMap = {
      banner: TestIds.BANNER,
      interstitial: TestIds.INTERSTITIAL,
    } as const
    return testMap[type]
  }

  const iosMap = {
    banner: appConfig.ads.ios.bannerAdUnitId,
    interstitial: appConfig.ads.ios.interstitialAdUnitId,
  } as const

  const androidMap = {
    banner: appConfig.ads.android.bannerAdUnitId,
    interstitial: appConfig.ads.android.interstitialAdUnitId,
  } as const

  return Platform.OS === 'ios' ? iosMap[type] : androidMap[type]
}

// ── SDK initialisation ────────────────────────────────────────────────────────

export const initMobileAds = async (appConfig: CoreConfig): Promise<void> => {
  if (!isAnyAdFormatEnabled(appConfig)) return

  try {
    await MobileAds().setRequestConfiguration({
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      maxAdContentRating: MaxAdContentRating.G,
    })
    await MobileAds().initialize()
  } catch (error) {
    recordError(error, 'adsService.initMobileAds')
    throw error
  }
}
