import {
  DropIcon,
  GaugeIcon,
  ProhibitIcon,
  SpeakerHifiIcon,
  WaveformIcon,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import type { PaywallFeatureItem } from '@/components/base/Paywall'

export const usePaywallFeatures = (): PaywallFeatureItem[] => {
  const { t } = useTranslation()

  return [
    {
      icon: DropIcon,
      title: t('paywall.features.waterEject.title'),
      description: t('paywall.features.waterEject.description'),
    },
    {
      icon: WaveformIcon,
      title: t('paywall.features.waveforms.title'),
      description: t('paywall.features.waveforms.description'),
    },
    {
      icon: SpeakerHifiIcon,
      title: t('paywall.features.stereoAuto.title'),
      description: t('paywall.features.stereoAuto.description'),
    },
    {
      icon: GaugeIcon,
      title: t('paywall.features.dbStats.title'),
      description: t('paywall.features.dbStats.description'),
    },
    {
      icon: ProhibitIcon,
      title: t('paywall.features.adFree.title'),
      description: t('paywall.features.adFree.description'),
    },
  ]
}
