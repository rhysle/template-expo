import Constants from 'expo-constants'
import * as StoreReview from 'expo-store-review'
import { Linking, Platform } from 'react-native'

import { AppConfig } from '@/configs'
import { recordError } from '@/services/sentry'

export const isReviewAvailable = (): Promise<boolean> => StoreReview.isAvailableAsync()

export const requestStoreReview = (): Promise<void> => StoreReview.requestReview()

const buildIosWriteReviewUrl = (appStoreId: string): string =>
  `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${appStoreId}?action=write-review`

const openUrlIfSupported = async (url: string | null): Promise<boolean> => {
  if (!url) return false

  const supported = await Linking.canOpenURL(url)
  if (!supported) return false

  await Linking.openURL(url)
  return true
}

const openAndroidReview = async (packageName: string): Promise<void> => {
  // market:// opens the native Play Store app directly; fall back to https:// on devices without Play Store
  const opened = await openUrlIfSupported(`market://details?id=${packageName}&showAllReviews=true`)
  if (!opened) {
    await openUrlIfSupported(
      `https://play.google.com/store/apps/details?id=${packageName}&showAllReviews=true`
    )
  }
}

export const openWriteReview = async (): Promise<void> => {
  try {
    if (Platform.OS === 'ios') {
      const appStoreId = AppConfig.iosAppStoreId.trim()
      if (!appStoreId) {
        recordError(new Error('openWriteReview: AppConfig.iosAppStoreId is not configured'))
        return
      }
      await openUrlIfSupported(buildIosWriteReviewUrl(appStoreId))
      return
    }

    const packageName = Constants.expoConfig?.android?.package?.trim()
    if (packageName) {
      await openAndroidReview(packageName)
    }
  } catch (error) {
    recordError(error)
  }
}
