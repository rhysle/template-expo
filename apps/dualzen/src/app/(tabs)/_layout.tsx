import { CapsuleTabNavigator } from '@shared/core/components/base/CapsuleTabNavigator'
import { useAutoPaywall } from '@shared/core/services/revenueCat'
import { usePathname } from 'expo-router'
import { GearIcon, SquaresFourIcon, VideoCameraIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { CaptureTabBar } from '@/components/navigation/CaptureTabBar'
import { ProjectsSelectionProvider } from '@/components/projects/ProjectsSelectionContext'
import { CaptureProvider } from '@/services/camera/CaptureProvider'
import { useCameraState } from '@/stores/features/camera'

export default function ProductLayout() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const { phase } = useCameraState()
  const captureActive = pathname === '/'
  useAutoPaywall(phase !== 'idle')
  return (
    <CaptureProvider active={captureActive}>
      <ProjectsSelectionProvider>
        <CapsuleTabNavigator
          navigationDisabled={phase !== 'idle'}
          tabBar={(props) => <CaptureTabBar {...props} />}
          tabs={[
            { name: 'index', label: t('camera.videoTitle'), icon: VideoCameraIcon },
            { name: 'projects', label: t('projects.title'), icon: SquaresFourIcon },
            { name: 'settings', label: t('settings.title'), icon: GearIcon },
          ]}
        />
      </ProjectsSelectionProvider>
    </CaptureProvider>
  )
}
