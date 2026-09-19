import { TabScreen } from '@shared/core/components/base'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { CameraScreen } from '@/components/camera/CameraScreen'
import { useCapture } from '@/services/camera/CaptureProvider'
import { createThemedStyles, useThemedStyles } from '@/theme'

export default function PhotoTab() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const recorder = useCapture()

  return (
    <TabScreen>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
        <CameraScreen
          mediaType="photo"
          recorder={recorder}
          onSettings={() => router.navigate('/settings')}
        />
      </SafeAreaView>
    </TabScreen>
  )
}

const createStyles = createThemedStyles(() => ({
  root: { flex: 1 },
}))
