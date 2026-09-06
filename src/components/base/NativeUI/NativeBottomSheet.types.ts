import type { ReactNode, Ref } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export type NativeBottomSheetPreset = 'content' | 'large' | 'resizable'

export interface NativeBottomSheetMethods {
  close: () => void
}

export interface NativeBottomSheetProps {
  ref?: Ref<NativeBottomSheetMethods>
  visible: boolean
  onDismiss: () => void
  children: ReactNode
  preset?: NativeBottomSheetPreset
  showDragIndicator?: boolean
  scrollable?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
  scrollHeader?: ReactNode
  scrollFooter?: ReactNode
}
