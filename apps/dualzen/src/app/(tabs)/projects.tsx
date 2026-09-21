import { TabScreen } from '@shared/core/components/base'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ProjectsScreen } from '@/components/projects/ProjectsScreen'

export default function ProjectsTab() {
  return (
    <TabScreen contentUnderTabBar>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <ProjectsScreen />
      </SafeAreaView>
    </TabScreen>
  )
}
