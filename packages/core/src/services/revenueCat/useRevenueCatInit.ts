import { useCoreRuntime } from '@shared/core/runtime'
import { setAnalyticsUserProperties } from '@shared/core/services/firebase/analytics'
import { recordError } from '@shared/core/services/sentry'
import { useSubscriptionState } from '@shared/core/stores/features/subscription'
import { useUserIdentityState } from '@shared/core/stores/features/userIdentity'
import { useEffect, useRef } from 'react'
import type { AppStateStatus } from 'react-native'
import { AppState } from 'react-native'

import {
  addCustomerInfoListener,
  checkEntitlement,
  getActiveEntitlementId,
  getCustomerInfo,
  getRevenueCatErrorDetails,
  initRevenueCat,
  isRevenueCatConnectivityError,
} from './revenueCatService'

/**
 * Initializes RevenueCat with the anonymous user ID, refreshes
 * subscription status, and attaches listeners for live updates.
 *
 * This is a hook replacement for RevenueCatProvider. It is a no-op
 * while userId is null (i.e., before useUserIdentityInit completes).
 *
 * Call once inside RootLayout.
 */
export const useRevenueCatInit = (): void => {
  const { config: appConfig } = useCoreRuntime()
  const { userId } = useUserIdentityState()
  const { setPremiumStatus } = useSubscriptionState()
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    if (!userId) return

    try {
      initRevenueCat(appConfig, userId)
    } catch (error) {
      setPremiumStatus('unknown', null)
      setAnalyticsUserProperties({ premium_state: 'unknown' })
      if (__DEV__) {
        console.warn('[RevenueCat] Failed to configure the SDK:', error)
      }
      recordError(error, 'useRevenueCatInit.configure', getRevenueCatErrorDetails(error))
      return
    }

    const refreshSubscriptionStatus = async () => {
      try {
        const customerInfo = await getCustomerInfo()
        const isActive = checkEntitlement(appConfig, customerInfo)
        setPremiumStatus(
          isActive ? 'premium' : 'free',
          getActiveEntitlementId(appConfig, customerInfo)
        )
        setAnalyticsUserProperties({ premium_state: isActive ? 'premium' : 'free' })
      } catch (error) {
        setPremiumStatus('unknown', null)
        setAnalyticsUserProperties({ premium_state: 'unknown' })
        // RevenueCat exposes stable error codes, so expected connectivity failures can be
        // filtered without relying on localized native error messages.
        if (!isRevenueCatConnectivityError(error)) {
          recordError(
            error,
            'useRevenueCatInit.refreshSubscriptionStatus',
            getRevenueCatErrorDetails(error)
          )
        }
      }
    }

    void refreshSubscriptionStatus()

    const removeListener = addCustomerInfoListener((customerInfo) => {
      const isActive = checkEntitlement(appConfig, customerInfo)
      setPremiumStatus(
        isActive ? 'premium' : 'free',
        getActiveEntitlementId(appConfig, customerInfo)
      )
      setAnalyticsUserProperties({ premium_state: isActive ? 'premium' : 'free' })
    })

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (appState.current !== 'active' && nextState === 'active') {
          void refreshSubscriptionStatus()
        }
        appState.current = nextState
      }
    )

    return () => {
      removeListener()
      appStateSubscription.remove()
    }
  }, [appConfig, userId, setPremiumStatus])
}
