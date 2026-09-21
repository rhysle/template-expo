import type { ReactNode, Ref } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export type NativeBottomSheetPreset = 'content' | 'large' | 'resizable'

/**
 * Controls the iOS presentation surface.
 *
 * `translucent` applies the app surface as a 50% tinted overlay, while `system`
 * leaves SwiftUI's native presentation background in place (Liquid Glass on
 * supported iOS versions).
 */
export type NativeBottomSheetBackgroundVariant = 'solid' | 'translucent' | 'system'

export interface NativeBottomSheetMethods {
  close: () => void
}

export interface NativeBottomSheetProps {
  ref?: Ref<NativeBottomSheetMethods>
  visible: boolean
  onDismiss: () => void
  children: ReactNode
  preset?: NativeBottomSheetPreset
  backgroundVariant?: NativeBottomSheetBackgroundVariant
  showDragIndicator?: boolean
  scrollable?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
  scrollHeader?: ReactNode
  scrollFooter?: ReactNode
}
