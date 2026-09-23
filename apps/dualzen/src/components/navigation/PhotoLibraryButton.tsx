import { CapsuleNavigationAccessory } from '@shared/core/components/base'
import { recordError } from '@shared/core/services/sentry'
import { ImagesIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'

import { iconSizes, useTheme } from '@/theme'

import NativeRecorder from '../../../modules/dual-recorder/src/DualRecorderModule'

const IOS_PHOTO_LIBRARY_URL = 'photos-redirect://'

export function PhotoLibraryButton({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation()
  const { colors } = useTheme()

  const openPhotoLibrary = () => {
    const request =
      Platform.OS === 'android'
        ? NativeRecorder.openPhotoLibrary()
        : Linking.openURL(IOS_PHOTO_LIBRARY_URL)
    void request.catch((cause) => {
      recordError(cause, 'camera.openPhotoLibrary', { platform: Platform.OS })
    })
  }

  return (
    <CapsuleNavigationAccessory
      accessibilityLabel={t('camera.openPhotoLibrary')}
      disabled={disabled}
      onPress={openPhotoLibrary}>
      <ImagesIcon size={iconSizes.lg} color={colors.text.primary} weight="regular" />
    </CapsuleNavigationAccessory>
  )
}
