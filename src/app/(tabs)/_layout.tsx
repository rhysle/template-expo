import { Tabs } from 'expo-router'
import { CurrencyCircleDollarIcon, FadersHorizontalIcon, IconProps } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { FloatingTabBar } from '@/components/base'
import { useConsentInit } from '@/services/ads'
import { useAutoPaywall } from '@/services/revenueCat'
import { useTheme } from '@/theme'

export default function TabLayout() {
  const { t } = useTranslation()
  const { colors, typography } = useTheme()

  // If AppConfig.ads.enabled is false, remove this call and run npm run setup:ads
  useConsentInit()
  useAutoPaywall()

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.base,
        },
        headerTitleStyle: {
          fontFamily: typography.fontFamily.semibold,
          fontWeight: typography.weights.semibold,
          color: colors.text.primary,
        },
        headerTintColor: colors.text.primary,
        lazy: false,
        tabBarStyle: { position: 'absolute', backgroundColor: 'transparent' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.convert'),
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <CurrencyCircleDollarIcon
              size={size}
              color={color as IconProps['color']}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <FadersHorizontalIcon
              size={size}
              color={color as IconProps['color']}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
    </Tabs>
  )
}
