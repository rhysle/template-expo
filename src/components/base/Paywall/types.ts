import type { Icon } from 'phosphor-react-native'

import type { PaywallSource } from '@/services/revenueCat'

export interface PaywallFeatureItem {
  icon: Icon
  title: string
  description?: string
}

export interface PaywallCallbacks {
  onSubscribeSuccess?: () => void
  onSubscribeError?: (error: unknown) => void
  onRestoreSuccess?: () => void
  onRestoreNoSubscription?: () => void
  onRestoreError?: (error: unknown) => void
}

export interface PaywallScreenProps extends PaywallCallbacks {
  title: string
  subtitle: string
  features: PaywallFeatureItem[]
  source: PaywallSource
  onComplete: () => void
  onDismiss: () => void
}
