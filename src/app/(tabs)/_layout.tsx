import { Tabs } from 'expo-router'
import {
  DropIcon,
  GaugeIcon,
  type IconProps,
  SpeakerHifiIcon,
  WaveformIcon,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { FloatingTabBar } from '@/components/base'
import { SettingsHeaderButton } from '@/components/SettingsHeaderButton'
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
      initialRouteName="index"
      tabBar={(props) => <FloatingTabBar {...props} showLabel />}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.base,
        },
        headerTitleStyle: {
          fontFamily: typography.fontFamily.semibold,
          fontWeight: typography.weights.semibold,
          color: colors.text.primary,
        },
        headerShadowVisible: false,
        headerTintColor: colors.text.primary,
        headerRight: () => <SettingsHeaderButton />,
        lazy: false,
        tabBarStyle: { position: 'absolute', backgroundColor: 'transparent' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.eject'),
          tabBarIcon: ({ color, size }) => (
            <DropIcon size={size} color={color as IconProps['color']} weight="regular" />
          ),
        }}
      />
      <Tabs.Screen
        name="tone-generator"
        options={{
          title: t('tabs.toneGenerator'),
          tabBarIcon: ({ color, size }) => (
            <WaveformIcon size={size} color={color as IconProps['color']} weight="regular" />
          ),
        }}
      />
      <Tabs.Screen
        name="stereo-test"
        options={{
          title: t('tabs.stereoTest'),
          tabBarIcon: ({ color, size }) => (
            <SpeakerHifiIcon size={size} color={color as IconProps['color']} weight="regular" />
          ),
        }}
      />
      <Tabs.Screen
        name="db-meter"
        options={{
          title: t('tabs.dbMeter'),
          tabBarIcon: ({ color, size }) => (
            <GaugeIcon size={size} color={color as IconProps['color']} weight="regular" />
          ),
        }}
      />
    </Tabs>
  )
}
