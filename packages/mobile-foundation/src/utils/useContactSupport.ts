import { useFoundationRuntime } from '@rhysle/mobile-foundation/runtime'
import {
  AnalyticsGeneralEvents,
  trackEvent,
} from '@rhysle/mobile-foundation/services/firebase/analytics'
import { getCurrentOtaUpdateId } from '@rhysle/mobile-foundation/services/otaUpdate'
import { useSnackbarState } from '@rhysle/mobile-foundation/stores/features/snackbar'
import { useUserIdentityState } from '@rhysle/mobile-foundation/stores/features/userIdentity'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'

export const useContactSupport = () => {
  const { config: appConfig } = useFoundationRuntime()
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
    const mailtoUrl = `mailto:${appConfig.support.email}?subject=${subject}&body=${body}`

    try {
      await Linking.openURL(mailtoUrl)
    } catch {
      showSnackbar({ title: t('settings.contactSupportError'), variant: 'error' })
    }
  }
}
