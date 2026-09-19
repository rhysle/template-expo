import { CapsuleTabNavigator } from '@shared/core/components/base/CapsuleTabNavigator'
import { useAutoPaywall } from '@shared/core/services/revenueCat'
import { usePathname } from 'expo-router'
import { CameraIcon, GearIcon, SquaresFourIcon, VideoCameraIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { CaptureProvider } from '@/services/camera/CaptureProvider'
import { useCameraState } from '@/stores/features/camera'

export default function ProductLayout() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const { phase } = useCameraState()
  const captureActive = pathname === '/' || pathname === '/photo'
  const mediaType = pathname === '/photo' ? 'photo' : 'video'
  useAutoPaywall(phase !== 'idle')
  return (
    <CaptureProvider active={captureActive} mediaType={mediaType}>
      <CapsuleTabNavigator
        navigationDisabled={phase !== 'idle'}
        tabs={[
          { name: 'index', label: t('camera.videoTitle'), icon: VideoCameraIcon },
          { name: 'photo', label: t('camera.photoTitle'), icon: CameraIcon },
          { name: 'projects', label: t('projects.title'), icon: SquaresFourIcon },
          { name: 'settings', label: t('settings.title'), icon: GearIcon },
        ]}
      />
    </CaptureProvider>
  )
}
