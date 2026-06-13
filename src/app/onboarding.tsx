import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { OnboardingFlow } from '@/components/base/Onboarding'
import { PaywallScreen } from '@/components/base/Paywall'
import { useOnboardingPages } from '@/components/onboarding/onboardingPages'
import { usePaywallFeatures } from '@/components/paywall/usePaywallFeatures'
import { AnalyticsEvents, trackEvent } from '@/services/firebase/analytics'
import { useOnboardingState } from '@/stores/features/onboarding'
import { useSnackbarState } from '@/stores/features/snackbar'
import { useSubscriptionState } from '@/stores/features/subscription'
import { haptics } from '@/utils/haptics'

export default function OnboardingScreen() {
  const { t } = useTranslation()
  const [showPaywall, setShowPaywall] = useState(false)
  const { completeOnboarding } = useOnboardingState()
  const { isSubscribed } = useSubscriptionState()
  const { showSnackbar } = useSnackbarState()
  const router = useRouter()
  const pages = useOnboardingPages()
  const features = usePaywallFeatures()

  useEffect(() => {
    trackEvent(AnalyticsEvents.ONBOARDING_STARTED)
  }, [])

  const handleOnboardingComplete = (skippingOnboarding = false) => {
    if (skippingOnboarding) {
      trackEvent(AnalyticsEvents.ONBOARDING_SKIPPED)
    } else {
      trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED)
    }
    if (isSubscribed) {
      handlePaywallDone()
      return
    }
    setShowPaywall(true)
  }

  const handlePaywallDone = () => {
    completeOnboarding()
    router.replace('/')
  }

  if (showPaywall) {
    return (
      <PaywallScreen
        title={t('paywall.title')}
        subtitle={t('paywall.subtitle')}
        features={features}
        onComplete={handlePaywallDone}
        onDismiss={handlePaywallDone}
        onSubscribeSuccess={() => {
          void haptics.light()
          showSnackbar({ title: t('paywall.feedback.subscribeSuccess'), variant: 'success' })
        }}
        onSubscribeError={() => {
          void haptics.medium()
          showSnackbar({ title: t('paywall.feedback.subscribeError'), variant: 'error' })
        }}
        onRestoreSuccess={() => {
          void haptics.light()
          showSnackbar({ title: t('paywall.feedback.restoreSuccess'), variant: 'success' })
        }}
        onRestoreNoSubscription={() => {
          showSnackbar({ title: t('paywall.feedback.restoreNotFound'), variant: 'warning' })
        }}
        onRestoreError={() => {
          void haptics.medium()
          showSnackbar({ title: t('paywall.feedback.restoreError'), variant: 'error' })
        }}
      />
    )
  }

  return (
    <OnboardingFlow
      pages={pages}
      swipeEnabled
      onComplete={handleOnboardingComplete}
      onSkip={() => handleOnboardingComplete(true)}
      onPageChange={(pageIndex, pageKey) => {
        trackEvent(AnalyticsEvents.ONBOARDING_PAGE_VIEWED, {
          page_index: pageIndex,
          page_key: pageKey,
        })
      }}
    />
  )
}
