import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { useTheme } from '@/theme'

import { useRegisterTabNavigator } from '../FloatingTabBar/tabBarHeight'
import type { TabNavigatorProps } from './TabDefinition'
import { TabNavigatorFrame } from './TabNavigatorFrame'

const MAX_ANDROID_TABS = 5

export const NativeTabNavigator = ({ tabs }: TabNavigatorProps) => {
  const { colors, typography } = useTheme()
  useRegisterTabNavigator('native')

  if (process.env.EXPO_OS === 'android' && tabs.length > MAX_ANDROID_TABS) {
    throw new Error(`NativeTabNavigator supports at most ${MAX_ANDROID_TABS} tabs on Android.`)
  }

  return (
    <TabNavigatorFrame>
      <NativeTabs
        backBehavior="initialRoute"
        disableTransparentOnScrollEdge
        rippleColor="transparent"
        labelVisibilityMode="selected"
        disableIndicator
        iconColor={{ default: colors.text.muted, selected: colors.primary.main }}
        labelStyle={{
          default: {
            color: colors.text.muted,
            fontFamily: typography.fontFamily.regular,
            fontWeight: typography.weights.regular,
          },
          selected: {
            color: colors.primary.main,
            fontFamily: typography.fontFamily.semibold,
            fontWeight: typography.weights.semibold,
          },
        }}
        minimizeBehavior="never"
        sidebarAdaptable={false}
        tintColor={colors.primary.main}>
        {tabs.map((tab) => (
          <NativeTabs.Trigger key={tab.name} name={tab.name}>
            <NativeTabs.Trigger.Icon {...tab.nativeIcon} />
            <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </TabNavigatorFrame>
  )
}
