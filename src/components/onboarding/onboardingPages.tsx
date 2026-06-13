import {
  ArrowsLeftRightIcon,
  ChartLineUpIcon,
  GlobeHemisphereWestIcon,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import type { OnboardingPageItem } from '@/components/base/Onboarding'

import { OnboardingScreenContent } from './OnboardingScreenContent'

export const useOnboardingPages = (): OnboardingPageItem[] => {
  const { t } = useTranslation()

  return [
    {
      key: 'welcome',
      content: (
        <OnboardingScreenContent
          icon={ArrowsLeftRightIcon}
          title={t('onboarding.welcome.title')}
          description={t('onboarding.welcome.description')}
        />
      ),
    },
    {
      key: 'features',
      content: (
        <OnboardingScreenContent
          icon={GlobeHemisphereWestIcon}
          title={t('onboarding.features.title')}
          description={t('onboarding.features.description')}
        />
      ),
    },
    {
      key: 'getStarted',
      content: (
        <OnboardingScreenContent
          icon={ChartLineUpIcon}
          title={t('onboarding.getStarted.title')}
          description={t('onboarding.getStarted.description')}
        />
      ),
    },
  ]
}
