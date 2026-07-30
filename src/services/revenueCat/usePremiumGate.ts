import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { usePaywallState } from '@/stores/features/paywall'
import { useSnackbarState } from '@/stores/features/snackbar'
import { useSubscriptionState } from '@/stores/features/subscription'

import { buildPaywallPath, type PaywallSource } from './premiumAccess'

export const usePremiumGate = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const { premiumState } = useSubscriptionState()
  const { showSnackbar } = useSnackbarState()
  const { setPaywallShowing } = usePaywallState()

  const presentPaywall = (source: PaywallSource) => {
    setPaywallShowing(true)
    router.push(buildPaywallPath(source))
  }

  const requirePremium = (source: PaywallSource, action: () => void) => {
    if (premiumState === 'premium') {
      action()
      return true
    }

    if (premiumState === 'loading' || premiumState === 'unknown') {
      showSnackbar({
        title:
          premiumState === 'loading' ? t('premium.accessChecking') : t('premium.accessUnknown'),
        variant: 'warning',
      })
      return false
    }

    presentPaywall(source)
    return false
  }

  const openPaywall = (source: PaywallSource) => {
    if (premiumState !== 'free') return
    presentPaywall(source)
  }

  return { requirePremium, openPaywall, premiumState }
}
