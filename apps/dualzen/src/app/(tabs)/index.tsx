import { SegmentedControl } from '@shared/core/components/base'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { CameraScreen } from '@/components/camera/CameraScreen'
import { ProjectsScreen } from '@/components/projects/ProjectsScreen'
import { useRecorder } from '@/services/camera/useRecorder'
import { createThemedStyles, useThemedStyles } from '@/theme'

export default function HomeScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const [focused, setFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, [])
  )
  const [mode, setMode] = useState('camera')
  const recorder = useRecorder(focused && mode === 'camera')
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.root}>
      <View style={styles.selector}>
        <SegmentedControl
          value={mode}
          disabled={recorder.phase !== 'idle'}
          onValueChange={setMode}
          options={[
            { value: 'camera', label: t('camera.title') },
            { value: 'projects', label: t('projects.title') },
          ]}
        />
      </View>
      {mode === 'camera' ? (
        <CameraScreen recorder={recorder} onSettings={() => router.push('/settings')} />
      ) : (
        <ProjectsScreen />
      )}
    </SafeAreaView>
  )
}
const createStyles = createThemedStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.base,
    paddingHorizontal: theme.spacing.md,
  },
  selector: {
    alignSelf: 'center',
    width: theme.spacing['9xl'] * 2,
    paddingVertical: theme.spacing.sm,
  },
}))
