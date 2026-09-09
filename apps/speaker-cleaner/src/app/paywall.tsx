import { PaywallScreen } from '@rhysle/core/components/base'
import { useSnackbarState } from '@rhysle/core/stores/features/snackbar'
import { haptics } from '@rhysle/core/utils/haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import {
  useContextualPaywallContent,
  usePaywallComparison,
} from '@/components/paywall/usePaywallFeatures'

export default function AutoPaywallScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { source: sourceParam } = useLocalSearchParams<{ source?: string }>()
  const { showSnackbar } = useSnackbarState()
  const source = sourceParam ?? 'direct'
  const comparisonItems = usePaywallComparison()
  const { title, subtitle } = useContextualPaywallContent(source)

  const handleDone = () => {
    router.back()
  }

  return (
    <PaywallScreen
      icon={require('@/assets/icons/ios-icon.png')}
      title={title}
      subtitle={subtitle}
      comparisonItems={comparisonItems}
      source={source}
      onComplete={handleDone}
      onDismiss={handleDone}
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
