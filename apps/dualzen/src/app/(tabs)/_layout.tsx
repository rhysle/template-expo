import { CapsuleTabNavigator } from '@shared/core/components/base/CapsuleTabNavigator'
import { useAutoPaywall } from '@shared/core/services/revenueCat'
import { SquaresFourIcon, VideoCameraIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { CaptureTabBar } from '@/components/navigation/CaptureTabBar'
import { ProjectsSelectionProvider } from '@/components/projects/ProjectsSelectionContext'
import { useCameraState } from '@/stores/features/camera'

export default function ProductLayout() {
  const { t } = useTranslation()
  const { phase } = useCameraState()
  useAutoPaywall(phase !== 'idle')
  return (
    <ProjectsSelectionProvider>
      <CapsuleTabNavigator
        navigationDisabled={phase !== 'idle'}
        tabBar={(props) => <CaptureTabBar {...props} />}
        tabs={[
          { name: 'index', label: t('camera.videoTitle'), icon: VideoCameraIcon },
          { name: 'projects', label: t('projects.title'), icon: SquaresFourIcon },
        ]}
      />
    </ProjectsSelectionProvider>
  )
}
