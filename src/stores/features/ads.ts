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
  // Interstitial trigger state (persisted)
  interstitialLastShownAt: number | null
  interstitialSessionCount: number
  incrementInterstitialSessionCount: () => void
  recordInterstitialShown: () => void
}

export const adsPersistExcludeKeys: ExcludeKeys<AdsSlice> = [
  'adsInitialized',
  'adsInitError',
  'canRequestAds',
  'consentGathered',
  'privacyOptionsRequired',
]

export const createAdsSlice = (set: (updater: (state: AdsSlice) => void) => void): AdsSlice => ({
  adsInitialized: false,
  adsInitError: null,
  canRequestAds: false,
  consentGathered: false,
  privacyOptionsRequired: false,
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
  interstitialLastShownAt: null,
  interstitialSessionCount: 0,
  incrementInterstitialSessionCount: () =>
    set((state) => {
      state.interstitialSessionCount += 1
    }),
  recordInterstitialShown: () =>
    set((state) => {
      state.interstitialLastShownAt = Date.now()
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
      interstitialLastShownAt: ads.interstitialLastShownAt,
      interstitialSessionCount: ads.interstitialSessionCount,
      incrementInterstitialSessionCount: ads.incrementInterstitialSessionCount,
      recordInterstitialShown: ads.recordInterstitialShown,
    }))
  )
