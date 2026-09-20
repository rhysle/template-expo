import { iconSizes } from '@shared/core/theme'
import { Tabs } from 'expo-router'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import type { IconProps } from 'phosphor-react-native'
import type { ReactNode } from 'react'

import { CapsuleTabBar } from '../CapsuleTabBar/CapsuleTabBar'
import { useRegisterTabNavigator } from '../FloatingTabBar/tabBarHeight'
import type { TabDefinition } from './TabDefinition'
import { TabNavigatorFrame } from './TabNavigatorFrame'

export interface CapsuleTabNavigatorProps {
  tabs: readonly Omit<TabDefinition, 'nativeIcon'>[]
  navigationDisabled?: boolean
  tabBar?: (props: BottomTabBarProps) => ReactNode
}

/** Optional alternative to the native and full-width custom tab navigators. */
export const CapsuleTabNavigator = ({
  tabs,
  navigationDisabled = false,
  tabBar,
}: CapsuleTabNavigatorProps) => {
  useRegisterTabNavigator('custom')

  if (tabs.length === 0 || tabs.length > 5) {
    throw new Error('CapsuleTabNavigator supports between one and five tabs.')
  }

  return (
    <TabNavigatorFrame>
      <Tabs
        initialRouteName={tabs[0]?.name}
        backBehavior="initialRoute"
        tabBar={(props) =>
          tabBar?.(props) ?? <CapsuleTabBar {...props} disabled={navigationDisabled} />
        }
        screenListeners={{
          tabPress: (event) => {
            if (navigationDisabled) event.preventDefault()
          },
        }}
        screenOptions={{
          headerShown: false,
          lazy: false,
          tabBarStyle: { position: 'absolute', backgroundColor: 'transparent' },
        }}>
        {tabs.map(({ name, label, icon: IconComponent }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: label,
              tabBarAccessibilityLabel: label,
              tabBarIcon: ({ color }) => (
                <IconComponent
                  color={color as IconProps['color']}
                  size={iconSizes.lg}
                  weight="regular"
                />
              ),
            }}
          />
        ))}
      </Tabs>
    </TabNavigatorFrame>
  )
}
