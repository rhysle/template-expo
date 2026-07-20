import { AlertDialog, Text, TextButton } from '@expo/ui/jetpack-compose'

import { useTheme } from '@/theme'

import { NativeUIHost } from '../NativeUIHost'
import type { NativeAlertDialogAction, NativeAlertDialogProps } from './NativeAlertDialog.types'

export const NativeAlertDialog = ({
  visible,
  title,
  message,
  confirmAction,
  dismissAction,
  onDismiss,
}: NativeAlertDialogProps) => {
  const { colors } = useTheme()

  if (!visible) return null

  const runAction = (action: NativeAlertDialogAction) => {
    action.onPress()
    onDismiss()
  }

  return (
    <NativeUIHost>
      <AlertDialog onDismissRequest={onDismiss}>
        <AlertDialog.Title>
          <Text>{title}</Text>
        </AlertDialog.Title>
        {message ? (
          <AlertDialog.Text>
            <Text>{message}</Text>
          </AlertDialog.Text>
        ) : null}
        <AlertDialog.ConfirmButton>
          <TextButton
            colors={
              confirmAction.role === 'destructive'
                ? { contentColor: colors.status.error }
                : undefined
            }
            onClick={() => runAction(confirmAction)}>
            <Text>{confirmAction.label}</Text>
          </TextButton>
        </AlertDialog.ConfirmButton>
        {dismissAction ? (
          <AlertDialog.DismissButton>
            <TextButton onClick={() => runAction(dismissAction)}>
              <Text>{dismissAction.label}</Text>
            </TextButton>
          </AlertDialog.DismissButton>
        ) : null}
      </AlertDialog>
    </NativeUIHost>
  )
}
