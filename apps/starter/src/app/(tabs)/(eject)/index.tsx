import { useSnackbarState } from '@rhysle/mobile-foundation/stores/features/snackbar'

import { Button } from '@/components/base'
import { TabPlaceholderScreen } from '@/components/TabPlaceholderScreen'

export default function HomeScreen() {
  const { showSnackbar } = useSnackbarState()

  return (
    <TabPlaceholderScreen description="Play cleaning sounds to help eject water and clear debris from your speaker.">
      <Button
        label="Show snackbar"
        onPress={() =>
          showSnackbar({
            title: 'Snackbar inset test',
            variant: 'info',
          })
        }
      />
    </TabPlaceholderScreen>
  )
}
