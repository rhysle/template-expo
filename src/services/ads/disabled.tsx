import { type PropsWithChildren, useEffect } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { useAdsState } from '@/stores/features/ads'

export const AdEventType = {
  CLOSED: 'closed',
  ERROR: 'error',
  LOADED: 'loaded',
  OPENED: 'opened',
} as const

export const AdsConsentDebugGeography = {
  DISABLED: 0,
  EEA: 1,
  NOT_EEA: 2,
} as const

export const AdsConsentPrivacyOptionsRequirementStatus = {
  UNKNOWN: 0,
  REQUIRED: 1,
  NOT_REQUIRED: 2,
} as const

export const BannerAdSize = {
  BANNER: 'BANNER',
} as const

export const TestIds = {
  BANNER: '',
  INTERSTITIAL: '',
} as const

const disabledConsentInfo = {
  canRequestAds: false,
  isConsentFormAvailable: false,
  privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED,
  status: 0,
}

export const AdsConsent = {
  gatherConsent: () => Promise.resolve(disabledConsentInfo),
  getConsentInfo: () => Promise.resolve(disabledConsentInfo),
  getGdprApplies: () => Promise.resolve(false),
  getPurposeConsents: () => Promise.resolve(''),
  requestInfoUpdate: () => Promise.resolve(disabledConsentInfo),
  showPrivacyOptionsForm: () => Promise.resolve(disabledConsentInfo),
}

const requestInterstitialAd = (): Promise<void> => Promise.resolve()
const removeAdEventListener = () => undefined

const disabledInterstitialAd = {
  addAdEventListener: () => removeAdEventListener,
  load: () => undefined,
  show: requestInterstitialAd,
}

export const InterstitialAd = {
  createForAdRequest: () => disabledInterstitialAd,
}

export const isAdsEnabled = (): boolean => false
export const isAnyAdFormatEnabled = (): boolean => false
export const isBannerAdsEnabled = (): boolean => false
export const isInterstitialAdsEnabled = (): boolean => false

export interface BannerAdDimensions {
  height: number
  width: number
}

export interface BannerAdProps {
  unitId?: string
  size?: string
  style?: StyleProp<ViewStyle>
  onAdLoaded?: (dimensions: BannerAdDimensions) => void
  onAdFailedToLoad?: (error: Error) => void
  onSizeChange?: (dimensions: BannerAdDimensions) => void
}

export const BannerAd = (_props: BannerAdProps) => null

interface InterstitialAdProviderProps extends PropsWithChildren {
  canPresent?: boolean
}

export const InterstitialAdProvider = ({ children }: InterstitialAdProviderProps) => children

export const useRequestInterstitialAd = () => requestInterstitialAd

export const useAdsInit = () => undefined

export const useCanShowAds = (): boolean => false

export const useConsentInit = () => {
  const { setCanRequestAds, setConsentGathered, setPrivacyOptionsRequired } = useAdsState()

  useEffect(() => {
    setCanRequestAds(false)
    setConsentGathered(true)
    setPrivacyOptionsRequired(false)
  }, [setCanRequestAds, setConsentGathered, setPrivacyOptionsRequired])
}

export const usePreventInterstitialAd = (_source: string, _shouldPrevent: boolean) => undefined
