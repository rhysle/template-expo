import {
  GlobeHemisphereWestIcon,
  LightningIcon,
  ProhibitIcon,
  TrendUpIcon,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import type { PaywallFeatureItem } from '@/components/base/Paywall'

export const usePaywallFeatures = (): PaywallFeatureItem[] => {
  const { t } = useTranslation()

  return [
    {
      icon: LightningIcon,
      title: t('paywall.features.liveRates.title'),
      description: t('paywall.features.liveRates.description'),
    },
    {
      icon: GlobeHemisphereWestIcon,
      title: t('paywall.features.unlimited.title'),
      description: t('paywall.features.unlimited.description'),
    },
    {
      icon: TrendUpIcon,
      title: t('paywall.features.charts.title'),
      description: t('paywall.features.charts.description'),
    },
    {
      icon: ProhibitIcon,
      title: t('paywall.features.adFree.title'),
      description: t('paywall.features.adFree.description'),
    },
  ]
}
