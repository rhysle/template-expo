import { useTranslation } from 'react-i18next'

import type { OnboardingPageItem } from '@/components/base/Onboarding'

import { type OnboardingAnimationConfig, OnboardingScreenContent } from './OnboardingScreenContent'

const onboardingAnimations = {
  page1: {
    source: require('@/assets/animations/onboarding/page-1.json'),
  },
  page2: {
    source: require('@/assets/animations/onboarding/page-2.json'),
  },
  page3: {
    source: require('@/assets/animations/onboarding/page-3.json'),
  },
  page4: {
    source: require('@/assets/animations/onboarding/page-4.json'),
  },
} as const satisfies Record<string, OnboardingAnimationConfig>

export const useOnboardingPages = (): OnboardingPageItem[] => {
  const { t } = useTranslation()

  return [
    {
      key: 'page1',
      content: (
        <OnboardingScreenContent
          animation={onboardingAnimations.page1}
          title={t('onboarding.waterEject.title')}
          description={t('onboarding.waterEject.description')}
        />
      ),
    },
    {
      key: 'page2',
      content: (
        <OnboardingScreenContent
          animation={onboardingAnimations.page2}
          title={t('onboarding.toneGenerator.title')}
          description={t('onboarding.toneGenerator.description')}
        />
      ),
    },
    {
      key: 'page3',
      content: (
        <OnboardingScreenContent
          animation={onboardingAnimations.page3}
          title={t('onboarding.dbMeter.title')}
          description={t('onboarding.dbMeter.description')}
        />
      ),
    },
    {
      key: 'page4',
      content: (
        <OnboardingScreenContent
          animation={onboardingAnimations.page4}
          title={t('onboarding.privacy.title')}
          description={t('onboarding.privacy.description')}
        />
      ),
    },
  ]
}
