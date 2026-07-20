import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export type NativeMenuTrigger = 'press' | 'longPress'

export interface NativeMenuAction {
  id: string
  label: string
  disabled?: boolean
  destructive?: boolean
  selected?: boolean
  children?: readonly NativeMenuAction[]
}

export interface NativeMenuProps {
  actions: readonly NativeMenuAction[]
  onSelect: (id: string) => void
  children: ReactNode
  title?: string
  trigger?: NativeMenuTrigger
  style?: StyleProp<ViewStyle>
  testID?: string
}
