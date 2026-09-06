import { useEffect, useState } from 'react'
import type { PurchasesPackage } from 'react-native-purchases'

import { AnalyticsGeneralEvents, trackEvent } from '@/services/firebase/analytics'
import {
  canMakePayments,
  fetchOfferings,
  getOfferingsFailureKind,
  getRevenueCatErrorDetails,
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

export type PaywallOfferingsStatus =
  'available' | 'configuration_error' | 'loading' | 'purchase_not_allowed' | 'temporary_error'

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
  const [offeringsStatus, setOfferingsStatus] = useState<PaywallOfferingsStatus>('loading')
  const [offeringsRequestId, setOfferingsRequestId] = useState(0)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadOfferings = async () => {
      setOfferingsStatus('loading')
      setPackages([])
      setSelectedPackage(null)

      try {
        const paymentsSupported = await canMakePayments()
        if (cancelled) return

        if (!paymentsSupported) {
          setOfferingsStatus('purchase_not_allowed')
          return
        }

        const availablePackages = await fetchOfferings()
        if (cancelled) return

        if (availablePackages.length === 0) {
          const error = new Error('RevenueCat current offering has no available packages')
          if (!__DEV__) {
            recordError(error, 'usePaywall.loadOfferings', {
              error_code: 'empty_offering',
              failure_kind: 'configuration',
              source,
            })
          }
          setOfferingsStatus('configuration_error')
          return
        }

        setPackages(availablePackages)
        setSelectedPackage(availablePackages[0])
        setOfferingsStatus('available')
      } catch (error: unknown) {
        if (cancelled) return

        const failureKind = getOfferingsFailureKind(error)
        if (failureKind === 'purchase_not_allowed') {
          setOfferingsStatus('purchase_not_allowed')
          return
        }

        setOfferingsStatus(failureKind === 'temporary' ? 'temporary_error' : 'configuration_error')

        // Connectivity and store availability errors are expected operational failures.
        // Configuration and unknown errors remain actionable in Sentry.
        if (!__DEV__ && failureKind !== 'temporary') {
          recordError(error, 'usePaywall.loadOfferings', {
            failure_kind: failureKind,
            source,
            ...getRevenueCatErrorDetails(error),
          })
        }
      }
    }

    void loadOfferings()

    return () => {
      cancelled = true
    }
  }, [offeringsRequestId, source])

  const retryOfferings = () => {
    setOfferingsRequestId((requestId) => requestId + 1)
  }

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
    offeringsStatus,
    retryOfferings,
    purchasing,
    handleSubscribe,
    handleRestore,
  }
}
