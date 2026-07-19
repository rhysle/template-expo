import { Tabs } from 'expo-router'
import type { Icon, IconProps } from 'phosphor-react-native'
import type { ColorValue } from 'react-native'

import { FloatingTabBar } from '../FloatingTabBar'
import { useRegisterTabNavigator } from '../FloatingTabBar/tabBarHeight'
import type { TabNavigatorProps } from './TabDefinition'

interface CustomTabIconProps {
  color: ColorValue
  icon: Icon
  size: number
}

const CustomTabIcon = ({ color, icon: IconComponent, size }: CustomTabIconProps) => (
  <IconComponent size={size} color={color as IconProps['color']} weight="regular" />
)

export const CustomTabNavigator = ({ tabs }: TabNavigatorProps) => {
  useRegisterTabNavigator('custom')

  return (
    <Tabs
      initialRouteName={tabs[0]?.name}
      tabBar={(props) => <FloatingTabBar {...props} showLabel />}
      screenOptions={{
        headerShown: false,
        lazy: false,
        tabBarStyle: { position: 'absolute', backgroundColor: 'transparent' },
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ color, size }) => (
              <CustomTabIcon color={color} icon={tab.icon} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
