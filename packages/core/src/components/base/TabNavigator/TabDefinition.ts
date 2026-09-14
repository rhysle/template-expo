import type { NativeTabsTriggerIconProps } from 'expo-router/unstable-native-tabs'
import type { Icon } from 'phosphor-react-native'

export interface TabDefinition {
  name: string
  label: string
  icon: Icon
  nativeIcon: NativeTabsTriggerIconProps
}

export interface TabNavigatorProps {
  tabs: readonly TabDefinition[]
}
