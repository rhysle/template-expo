import type { PaywallSource } from '@shared/core/services/revenueCat'
import type { Icon } from 'phosphor-react-native'

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
  icon: import('expo-image').ImageSource
  title: string
  subtitle: string
  comparisonItems: PaywallComparisonItem[]
  source: PaywallSource
  onComplete: () => void
  onDismiss: () => void
}
