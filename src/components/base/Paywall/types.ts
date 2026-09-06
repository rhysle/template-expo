import type { Icon } from 'phosphor-react-native'

import type { PaywallSource } from '@/services/revenueCat'

export type PaywallComparisonValue =
  | { type: 'text'; text: string }
  | { type: 'included' }
  | { type: 'excluded' }
  | { type: 'unlimited' }

export interface PaywallComparisonItem {
  id: string
  icon: Icon
  title: string
  free: PaywallComparisonValue
  pro: PaywallComparisonValue
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
  comparisonItems: PaywallComparisonItem[]
  source: PaywallSource
  onComplete: () => void
  onDismiss: () => void
}
