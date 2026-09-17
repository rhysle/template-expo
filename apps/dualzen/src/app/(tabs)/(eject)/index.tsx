import { Button, TabPlaceholderScreen } from '@shared/core/components/base'
import { useSnackbarState } from '@shared/core/stores/features/snackbar'

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
