import { useRouter } from 'expo-router'

import { useSubscriptionState } from '@/stores/features/subscription'

export const usePremiumGate = () => {
  const router = useRouter()
  const { isSubscribed } = useSubscriptionState()

  const gate = (action: () => void) => {
    if (isSubscribed) {
      action()
    } else {
      router.push('/paywall')
    }
  }

  const openPaywall = () => router.push('/paywall')

  return { gate, openPaywall, isSubscribed }
}
