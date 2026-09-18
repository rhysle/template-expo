import { TabScreen } from '@shared/core/components/base'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ProjectsScreen } from '@/components/projects/ProjectsScreen'
import { createThemedStyles, useThemedStyles } from '@/theme'

export default function ProjectsTab() {
  const styles = useThemedStyles(createStyles)
  return (
    <TabScreen>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
        <ProjectsScreen />
      </SafeAreaView>
    </TabScreen>
  )
}

const createStyles = createThemedStyles((theme) => ({
  root: { flex: 1, paddingHorizontal: theme.spacing.md },
}))
