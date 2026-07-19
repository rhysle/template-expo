import { DropIcon, GaugeIcon, SpeakerHifiIcon, WaveformIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { NativeTabNavigator as TabNavigator, type TabDefinition } from '@/components/base'
import { useConsentInit } from '@/services/ads'
import { useAutoPaywall } from '@/services/revenueCat'

export const unstable_settings = {
  initialRouteName: '(eject)',
}

export default function TabLayout() {
  const { t } = useTranslation()

  // If AppConfig.ads.enabled is false, remove this call and run npm run setup:ads
  useConsentInit()
  useAutoPaywall()

  const tabs = [
    {
      name: '(eject)',
      label: t('tabs.eject'),
      icon: DropIcon,
      nativeIcon: {
        sf: { default: 'drop', selected: 'drop.fill' },
        md: 'water_drop',
      },
    },
    {
      name: 'tone-generator',
      label: t('tabs.toneGenerator'),
      icon: WaveformIcon,
      nativeIcon: {
        sf: 'waveform',
        md: 'graphic_eq',
      },
    },
    {
      name: 'stereo-test',
      label: t('tabs.stereoTest'),
      icon: SpeakerHifiIcon,
      nativeIcon: {
        sf: { default: 'hifispeaker.2', selected: 'hifispeaker.2.fill' },
        md: 'speaker',
      },
    },
    {
      name: 'db-meter',
      label: t('tabs.dbMeter'),
      icon: GaugeIcon,
      nativeIcon: {
        sf: 'gauge.with.dots.needle.50percent',
        md: 'speed',
      },
    },
  ] satisfies readonly TabDefinition[]

  return <TabNavigator tabs={tabs} />
}
