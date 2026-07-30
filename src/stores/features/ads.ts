import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    ads: AdsSlice
  }
}

export interface AdsSlice {
  // SDK init state (runtime, not persisted)
  adsInitialized: boolean
  adsInitError: string | null
  canRequestAds: boolean
  consentGathered: boolean
  privacyOptionsRequired: boolean
  setAdsInitialized: (initialized: boolean) => void
  setAdsInitError: (error: string | null) => void
  setCanRequestAds: (canRequest: boolean) => void
  setConsentGathered: (gathered: boolean) => void
  setPrivacyOptionsRequired: (required: boolean) => void
  // Runtime presentation state
  interstitialAdPreventionSources: string[]
  interstitialShownThisForeground: boolean
  setInterstitialAdPrevented: (source: string, prevented: boolean) => void
  resetInterstitialForegroundCap: () => void
  // Interstitial completion state (persisted)
  interstitialLastShownAt: number | null
  interstitialQualifyingCompletionsSinceLastAd: number
  recordInterstitialQualifyingCompletion: () => void
  recordInterstitialShown: () => void
}

export const adsPersistExcludeKeys: ExcludeKeys<AdsSlice> = [
  'adsInitialized',
  'adsInitError',
  'canRequestAds',
  'consentGathered',
  'privacyOptionsRequired',
  'interstitialAdPreventionSources',
  'interstitialShownThisForeground',
]

export const createAdsSlice = (set: (updater: (state: AdsSlice) => void) => void): AdsSlice => ({
  adsInitialized: false,
  adsInitError: null,
  canRequestAds: false,
  consentGathered: false,
  privacyOptionsRequired: false,
  interstitialAdPreventionSources: [],
  interstitialShownThisForeground: false,
  setAdsInitialized: (initialized) =>
    set((state) => {
      state.adsInitialized = initialized
      state.adsInitError = null
    }),
  setAdsInitError: (error) =>
    set((state) => {
      state.adsInitialized = false
      state.adsInitError = error
    }),
  setCanRequestAds: (canRequest) =>
    set((state) => {
      state.canRequestAds = canRequest
    }),
  setConsentGathered: (gathered) =>
    set((state) => {
      state.consentGathered = gathered
    }),
  setPrivacyOptionsRequired: (required) =>
    set((state) => {
      state.privacyOptionsRequired = required
    }),
  setInterstitialAdPrevented: (source, prevented) =>
    set((state) => {
      const sources = state.interstitialAdPreventionSources.filter((item) => item !== source)
      state.interstitialAdPreventionSources = prevented ? [...sources, source] : sources
    }),
  resetInterstitialForegroundCap: () =>
    set((state) => {
      state.interstitialShownThisForeground = false
    }),
  interstitialLastShownAt: null,
  interstitialQualifyingCompletionsSinceLastAd: 0,
  recordInterstitialQualifyingCompletion: () =>
    set((state) => {
      state.interstitialQualifyingCompletionsSinceLastAd += 1
    }),
  recordInterstitialShown: () =>
    set((state) => {
      state.interstitialLastShownAt = Date.now()
      state.interstitialQualifyingCompletionsSinceLastAd = 0
      state.interstitialShownThisForeground = true
    }),
})

export const sliceConfig = {
  create: createAdsSlice,
  persistExcludeKeys: adsPersistExcludeKeys,
} satisfies SliceConfig<AdsSlice>

export const useAdsState = () =>
  getUseAppStore()(
    useShallow(({ ads }) => ({
      adsInitialized: ads.adsInitialized,
      adsInitError: ads.adsInitError,
      canRequestAds: ads.canRequestAds,
      consentGathered: ads.consentGathered,
      privacyOptionsRequired: ads.privacyOptionsRequired,
      setAdsInitialized: ads.setAdsInitialized,
      setAdsInitError: ads.setAdsInitError,
      setCanRequestAds: ads.setCanRequestAds,
      setConsentGathered: ads.setConsentGathered,
      setPrivacyOptionsRequired: ads.setPrivacyOptionsRequired,
      interstitialAdPreventionSources: ads.interstitialAdPreventionSources,
      interstitialShownThisForeground: ads.interstitialShownThisForeground,
      setInterstitialAdPrevented: ads.setInterstitialAdPrevented,
      resetInterstitialForegroundCap: ads.resetInterstitialForegroundCap,
      interstitialLastShownAt: ads.interstitialLastShownAt,
      interstitialQualifyingCompletionsSinceLastAd:
        ads.interstitialQualifyingCompletionsSinceLastAd,
      recordInterstitialQualifyingCompletion: ads.recordInterstitialQualifyingCompletion,
      recordInterstitialShown: ads.recordInterstitialShown,
    }))
  )
