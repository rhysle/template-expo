import { useEffect, useState } from 'react'
import type { PurchasesPackage } from 'react-native-purchases'

import { AnalyticsGeneralEvents, trackEvent } from '@/services/firebase/analytics'
import {
  fetchOfferings,
  getRevenueCatErrorDetails,
  isBillingUnavailableError,
  type PaywallSource,
  purchasePackage,
  restorePurchases,
} from '@/services/revenueCat'
import { recordError } from '@/services/sentry'

import type { PaywallCallbacks } from './types'

interface UsePaywallOptions extends PaywallCallbacks {
  onComplete: () => void
  source: PaywallSource
}

export const usePaywall = ({
  onComplete,
  onSubscribeSuccess,
  onSubscribeError,
  onRestoreSuccess,
  onRestoreNoSubscription,
  onRestoreError,
  source,
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

    const purchaseDetails = {
      package_id: selectedPackage.identifier,
      package_type: selectedPackage.packageType,
      source,
    }

    trackEvent(AnalyticsGeneralEvents.PAYWALL_SUBSCRIBE, purchaseDetails)
    setPurchasing(true)
    try {
      const result = await purchasePackage(selectedPackage)
      if (result.outcome === 'success') {
        trackEvent(AnalyticsGeneralEvents.PAYWALL_SUBSCRIBE_SUCCESS, purchaseDetails)
        onSubscribeSuccess?.()
        onComplete()
      } else if (result.outcome === 'cancelled') {
        trackEvent(AnalyticsGeneralEvents.PAYWALL_SUBSCRIBE_CANCELLED, purchaseDetails)
      } else {
        const error = new Error('Entitlement not found after purchase')
        const errorDetails = {
          ...purchaseDetails,
          error_code: 'entitlement_missing',
          active_entitlement_ids:
            Object.keys(result.customerInfo.entitlements.active).join(',') || 'none',
        }

        trackEvent(AnalyticsGeneralEvents.PAYWALL_SUBSCRIBE_ERROR, {
          ...purchaseDetails,
          error_code: errorDetails.error_code,
        })
        recordError(error, 'usePaywall.handleSubscribe', errorDetails)
        onSubscribeError?.(error)
      }
    } catch (error: unknown) {
      const revenueCatDetails = getRevenueCatErrorDetails(error)
      const readableErrorCode = revenueCatDetails?.readableErrorCode
      const nativeErrorCode = revenueCatDetails?.code
      const errorCode =
        typeof readableErrorCode === 'string'
          ? readableErrorCode
          : typeof nativeErrorCode === 'string'
            ? nativeErrorCode
            : 'unknown'

      trackEvent(AnalyticsGeneralEvents.PAYWALL_SUBSCRIBE_ERROR, {
        ...purchaseDetails,
        error_code: errorCode,
      })
      recordError(error, 'usePaywall.handleSubscribe', {
        ...purchaseDetails,
        error_code: errorCode,
        ...revenueCatDetails,
      })
      onSubscribeError?.(error)
    } finally {
      setPurchasing(false)
    }
  }

  const handleRestore = async () => {
    trackEvent(AnalyticsGeneralEvents.PAYWALL_RESTORE, { source })
    setPurchasing(true)
    try {
      const result = await restorePurchases()
      if (result.success) {
        trackEvent(AnalyticsGeneralEvents.PAYWALL_RESTORE_SUCCESS, { source })
        onRestoreSuccess?.()
        onComplete()
      } else {
        onRestoreNoSubscription?.()
      }
    } catch (error: unknown) {
      trackEvent(AnalyticsGeneralEvents.PAYWALL_RESTORE_ERROR, { source })
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
