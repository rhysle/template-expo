export type NativeAlertDialogActionRole = 'default' | 'cancel' | 'destructive'

export interface NativeAlertDialogAction {
  label: string
  onPress: () => void
  role?: NativeAlertDialogActionRole
}

export interface NativeAlertDialogProps {
  visible: boolean
  title: string
  message?: string
  confirmAction: NativeAlertDialogAction
  dismissAction?: NativeAlertDialogAction
  onDismiss: () => void
}
