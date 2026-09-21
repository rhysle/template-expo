import type { MenuAction } from '@expo/ui/community/menu'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export type NativeMenuTrigger = 'press' | 'longPress'

export interface NativeMenuAction {
  id: string
  label: string
  disabled?: boolean
  destructive?: boolean
  image?: MenuAction['image']
  imageColor?: MenuAction['imageColor']
  selected?: boolean
  children?: readonly NativeMenuAction[]
}

export interface NativeMenuProps {
  actions: readonly NativeMenuAction[]
  onSelect: (id: string) => void
  children: ReactNode
  /** Optional informational text rendered at the bottom of the native menu. */
  footer?: string
  title?: string
  trigger?: NativeMenuTrigger
  style?: StyleProp<ViewStyle>
  testID?: string
}
