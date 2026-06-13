import { useEffect, useRef } from 'react'
import type { AppStateStatus } from 'react-native'
import { AppState } from 'react-native'

import { setAnalyticsUserProperties } from '@/services/firebase/analytics'
import { recordError } from '@/services/sentry'
import { useSubscriptionState } from '@/stores/features/subscription'
import { useUserIdentityState } from '@/stores/features/userIdentity'

import {
  addCustomerInfoListener,
  checkEntitlement,
  getActiveEntitlementId,
  getCustomerInfo,
  initRevenueCat,
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
  const { userId } = useUserIdentityState()
  const { setSubscriptionStatus, setRevenueCatReady } = useSubscriptionState()
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    if (!userId) return

    initRevenueCat(userId)

    const refreshSubscriptionStatus = async () => {
      try {
        const customerInfo = await getCustomerInfo()
        const isActive = checkEntitlement(customerInfo)
        setSubscriptionStatus(isActive, getActiveEntitlementId(customerInfo))
        setAnalyticsUserProperties({ is_subscribed: isActive ? 'true' : 'false' })
      } catch (error) {
        // Subscription state stays as default (false) - app remains functional.
        recordError(error, 'useRevenueCatInit.refreshSubscriptionStatus')
      } finally {
        setRevenueCatReady(true)
      }
    }

    void refreshSubscriptionStatus()

    const removeListener = addCustomerInfoListener((customerInfo) => {
      const isActive = checkEntitlement(customerInfo)
      setSubscriptionStatus(isActive, getActiveEntitlementId(customerInfo))
      setAnalyticsUserProperties({ is_subscribed: isActive ? 'true' : 'false' })
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
  }, [userId, setSubscriptionStatus, setRevenueCatReady])
}
