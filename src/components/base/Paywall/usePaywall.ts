import { useEffect, useState } from 'react'
import type { PurchasesPackage } from 'react-native-purchases'

import { AnalyticsEvents, trackEvent } from '@/services/firebase/analytics'
import {
  fetchOfferings,
  isBillingUnavailableError,
  purchasePackage,
  restorePurchases,
} from '@/services/revenueCat'
import { recordError } from '@/services/sentry'

import type { PaywallCallbacks } from './types'

interface UsePaywallOptions extends PaywallCallbacks {
  onComplete: () => void
}

export const usePaywall = ({
  onComplete,
  onSubscribeSuccess,
  onSubscribeError,
  onRestoreSuccess,
  onRestoreNoSubscription,
  onRestoreError,
}: UsePaywallOptions) => {
  const [packages, setPackages] = useState<PurchasesPackage[]>([])
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const availablePackages = await fetchOfferings()
        setPackages(availablePackages)
        if (availablePackages.length > 0) {
          setSelectedPackage(availablePackages[0])
        }
      } catch (error) {
        // Offerings may not be available during development.
        // In production, log so SDK/network failures are visible.
        if (!__DEV__ && !isBillingUnavailableError(error)) {
          recordError(error, 'usePaywall.loadOfferings')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadOfferings()
  }, [])

  const handleSubscribe = async () => {
    if (!selectedPackage) return

    trackEvent(AnalyticsEvents.PAYWALL_SUBSCRIBE_TAPPED, {
      package_id: selectedPackage.identifier,
    })
    setPurchasing(true)
    try {
      const result = await purchasePackage(selectedPackage)
      if (result.success) {
        trackEvent(AnalyticsEvents.PAYWALL_SUBSCRIBE_SUCCESS, {
          package_id: selectedPackage.identifier,
        })
        onSubscribeSuccess?.()
        onComplete()
      } else if (result.customerInfo) {
        // Purchase completed but entitlement not found
        trackEvent(AnalyticsEvents.PAYWALL_SUBSCRIBE_ERROR, {
          package_id: selectedPackage.identifier,
        })
        onSubscribeError?.(new Error('Entitlement not found after purchase'))
      }
      // customerInfo is null when user cancelled - stay silent
    } catch (error: unknown) {
      trackEvent(AnalyticsEvents.PAYWALL_SUBSCRIBE_ERROR, {
        package_id: selectedPackage.identifier,
      })
      onSubscribeError?.(error)
    } finally {
      setPurchasing(false)
    }
  }

  const handleRestore = async () => {
    trackEvent(AnalyticsEvents.PAYWALL_RESTORE_TAPPED)
    setPurchasing(true)
    try {
      const result = await restorePurchases()
      if (result.success) {
        trackEvent(AnalyticsEvents.PAYWALL_RESTORE_SUCCESS)
        onRestoreSuccess?.()
        onComplete()
      } else {
        onRestoreNoSubscription?.()
      }
    } catch (error: unknown) {
      trackEvent(AnalyticsEvents.PAYWALL_RESTORE_ERROR)
      onRestoreError?.(error)
    } finally {
      setPurchasing(false)
    }
  }

  return {
    packages,
    selectedPackage,
    setSelectedPackage,
    loading,
    purchasing,
    handleSubscribe,
    handleRestore,
  }
}
