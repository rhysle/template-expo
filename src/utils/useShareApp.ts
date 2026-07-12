import Constants from 'expo-constants'
import { useTranslation } from 'react-i18next'
import { Platform, Share } from 'react-native'

import { AppConfig } from '@/configs'
import { AnalyticsGeneralEvents, trackEvent } from '@/services/firebase/analytics'
import { recordError } from '@/services/sentry'

export const useShareApp = () => {
  const { t } = useTranslation()

  return async (): Promise<void> => {
    trackEvent(AnalyticsGeneralEvents.SHARE_APP)
    const appName = Constants.expoConfig?.name ?? 'App'

    let storeUrl: string | undefined

    if (Platform.OS === 'ios') {
      const appStoreId = AppConfig.iosAppStoreId.trim()
      if (appStoreId) {
        storeUrl = `https://apps.apple.com/app/id${appStoreId}`
      }
    } else {
      const pkg = Constants.expoConfig?.android?.package?.trim()
      if (pkg) {
        storeUrl = `https://play.google.com/store/apps/details?id=${pkg}`
      }
    }

    try {
      if (Platform.OS === 'ios' && storeUrl) {
        await Share.share({ message: t('settings.shareMessage', { appName }), url: storeUrl })
      } else {
        const message = storeUrl
          ? t('settings.shareMessageWithUrl', { appName, url: storeUrl })
          : t('settings.shareMessage', { appName })
        await Share.share({ message })
      }
    } catch (err) {
      recordError(err instanceof Error ? err : new Error(String(err)))
    }
  }
}
