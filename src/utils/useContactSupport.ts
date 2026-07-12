import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'

import { AppConfig } from '@/configs'
import { AnalyticsGeneralEvents, trackEvent } from '@/services/firebase/analytics'
import { getCurrentOtaUpdateId } from '@/services/otaUpdate'
import { useSnackbarState } from '@/stores/features/snackbar'
import { useUserIdentityState } from '@/stores/features/userIdentity'

export const useContactSupport = () => {
  const { t } = useTranslation()
  const { userId } = useUserIdentityState()
  const { showSnackbar } = useSnackbarState()
  const currentOtaUpdateId = getCurrentOtaUpdateId()

  return async (): Promise<void> => {
    trackEvent(AnalyticsGeneralEvents.CONTACT_SUPPORT)
    const appName = Constants.expoConfig?.name ?? 'Unknown App'
    const appVersion = Constants.expoConfig?.version ?? 'Unknown'
    const osName = Platform.OS === 'ios' ? 'iOS' : 'Android'
    const osVersion = Device.osVersion ?? 'Unknown'
    const deviceModel = Device.modelName ?? 'Unknown'

    const subject = encodeURIComponent(`Support Request - ${appName}`)
    const body = encodeURIComponent(
      `\n---\nApp: ${appName}\nVersion: ${appVersion}${currentOtaUpdateId !== null ? `\nUpdate ID: ${currentOtaUpdateId}` : ''}\nPlatform: ${osName} ${osVersion}\nDevice: ${deviceModel}\nUser ID: ${userId ?? 'N/A'}\n---`
    )
    const mailtoUrl = `mailto:${AppConfig.support.email}?subject=${subject}&body=${body}`

    try {
      await Linking.openURL(mailtoUrl)
    } catch {
      showSnackbar({ title: t('settings.contactSupportError'), variant: 'error' })
    }
  }
}
