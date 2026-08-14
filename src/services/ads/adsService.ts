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

import { AppConfig } from '@/configs'
import { recordError } from '@/services/sentry'

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

export const isAdsEnabled = (): boolean => AppConfig.ads.enabled
export const isBannerAdsEnabled = (): boolean =>
  AppConfig.ads.enabled && AppConfig.ads.banner.enabled
export const isInterstitialAdsEnabled = (): boolean =>
  AppConfig.ads.enabled && AppConfig.ads.interstitial.enabled
export const isAnyAdFormatEnabled = (): boolean =>
  isBannerAdsEnabled() || isInterstitialAdsEnabled()

// ── Ad unit IDs ───────────────────────────────────────────────────────────────

export const getAdUnitId = (type: 'banner' | 'interstitial'): string => {
  if (!AppConfig.ads.enabled || __DEV__) {
    const testMap = {
      banner: TestIds.BANNER,
      interstitial: TestIds.INTERSTITIAL,
    } as const
    return testMap[type]
  }

  const iosMap = {
    banner: AppConfig.ads.ios.bannerAdUnitId,
    interstitial: AppConfig.ads.ios.interstitialAdUnitId,
  } as const

  const androidMap = {
    banner: AppConfig.ads.android.bannerAdUnitId,
    interstitial: AppConfig.ads.android.interstitialAdUnitId,
  } as const

  return Platform.OS === 'ios' ? iosMap[type] : androidMap[type]
}

// ── SDK initialisation ────────────────────────────────────────────────────────

export const initMobileAds = async (): Promise<void> => {
  if (!isAnyAdFormatEnabled()) return

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
