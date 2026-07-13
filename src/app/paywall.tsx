import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { PaywallScreen } from '@/components/base/Paywall'
import { usePaywallFeatures } from '@/components/paywall/usePaywallFeatures'
import { useSnackbarState } from '@/stores/features/snackbar'
import { haptics } from '@/utils/haptics'

export default function AutoPaywallScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { showSnackbar } = useSnackbarState()
  const features = usePaywallFeatures()

  const handleDone = () => {
    router.back()
  }

  return (
    <PaywallScreen
      title={t('paywall.title')}
      subtitle={t('paywall.subtitle')}
      features={features}
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
