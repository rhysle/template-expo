import { CapsuleTabNavigator } from '@shared/core/components/base/CapsuleTabNavigator'
import { useAutoPaywall } from '@shared/core/services/revenueCat'
import { CameraIcon, GearIcon, SquaresFourIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { useCameraState } from '@/stores/features/camera'

export default function ProductLayout() {
  const { t } = useTranslation()
  const { phase } = useCameraState()
  useAutoPaywall(phase !== 'idle')
  return (
    <CapsuleTabNavigator
      navigationDisabled={phase !== 'idle'}
      tabs={[
        { name: 'index', label: t('camera.title'), icon: CameraIcon },
        { name: 'projects', label: t('projects.title'), icon: SquaresFourIcon },
        { name: 'settings', label: t('settings.title'), icon: GearIcon },
      ]}
    />
  )
}
