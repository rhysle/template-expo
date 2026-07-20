import { Alert, Button, Text } from '@expo/ui/swift-ui'
import { frame, opacity } from '@expo/ui/swift-ui/modifiers'

import { NativeUIHost } from '../NativeUIHost'
import type { NativeAlertDialogAction, NativeAlertDialogProps } from './NativeAlertDialog.types'

const actionButton = (action: NativeAlertDialogAction) => (
  <Button key={action.label} label={action.label} role={action.role} onPress={action.onPress} />
)

export const NativeAlertDialog = ({
  visible,
  title,
  message,
  confirmAction,
  dismissAction,
  onDismiss,
}: NativeAlertDialogProps) => (
  <NativeUIHost>
    <Alert
      title={title}
      isPresented={visible}
      onIsPresentedChange={(isPresented) => {
        if (!isPresented) onDismiss()
      }}>
      <Alert.Trigger>
        <Text modifiers={[frame({ width: 0, height: 0 }), opacity(0)]}> </Text>
      </Alert.Trigger>
      <Alert.Actions>
        {dismissAction ? actionButton(dismissAction) : null}
        {actionButton(confirmAction)}
      </Alert.Actions>
      {message ? (
        <Alert.Message>
          <Text>{message}</Text>
        </Alert.Message>
      ) : null}
    </Alert>
  </NativeUIHost>
)
