import { useEffect } from 'react'

import { setAnalyticsUserId } from '@/services/firebase/analytics'
import { setSentryUser } from '@/services/sentry'
import { useUserIdentityState } from '@/stores/features/userIdentity'

import { getOrCreateUserId } from './userIdentityService'

/**
 * Loads (or generates) the anonymous user ID on mount, writes it to the
 * userIdentity Zustand slice, and sets it on Sentry + Firebase Analytics.
 *
 * RevenueCat initialization is handled separately by useRevenueCatInit,
 * which watches the slice and fires once userId is non-null.
 *
 * Call once inside RootLayout.
 */
export const useUserIdentityInit = (): void => {
  const { setUserId } = useUserIdentityState()

  useEffect(() => {
    const init = async () => {
      const userId = await getOrCreateUserId()
      setUserId(userId)
      setSentryUser(userId)
      setAnalyticsUserId(userId)
    }

    void init()
  }, [setUserId])
}
