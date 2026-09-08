import { Button } from '@rhysle/core/components/base'
import { useSnackbarState } from '@rhysle/core/stores/features/snackbar'

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
