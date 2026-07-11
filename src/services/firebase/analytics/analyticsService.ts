import analytics from '@react-native-firebase/analytics'

import { recordError } from '@/services/sentry'

import type { AnalyticsEventName } from './types'

/**
 * Track a typed analytics event.
 * Param values must be `string | number` - Firebase Analytics requirement.
 * Import `AnalyticsEvents` for generic events or `AppAnalyticsEvents` for
 * app-specific ones; both satisfy `AnalyticsEventName`.
 */
export const trackEvent = (
  eventName: AnalyticsEventName,
  params?: Record<string, string | number>
): void => {
  analytics()
    .logEvent(eventName, params)
    .catch((error: unknown) => {
      if (__DEV__) {
        console.warn(`[Analytics] Failed to log event "${eventName}":`, error)
      }
      recordError(error, `analytics.trackEvent: ${eventName}`)
    })
}

/**
 * Log a screen view event.
 * Called automatically by ScreenTracker on every Expo Router pathname change -
 * no manual calls needed per screen.
 */
export const trackScreenView = (screenName: string): void => {
  analytics()
    .logScreenView({ screen_name: screenName, screen_class: screenName })
    .catch((error: unknown) => {
      if (__DEV__) {
        console.warn(`[Analytics] Failed to log screen_view "${screenName}":`, error)
      }
      recordError(error, `analytics.trackScreenView: ${screenName}`)
    })
}

/** Set the Analytics user ID (pass `null` to clear on logout). */
export const setAnalyticsUserId = (userId: string | null): void => {
  void analytics().setUserId(userId)
}

/**
 * Set Firebase Analytics user properties.
 * Values MUST be strings - Firebase Analytics does not accept boolean or number here.
 * Call once per property change; values persist across sessions until overwritten.
 */
export const setAnalyticsUserProperties = (properties: Record<string, string>): void => {
  analytics()
    .setUserProperties(properties)
    .catch((error: unknown) => {
      if (__DEV__) {
        console.warn('[Analytics] Failed to set user properties:', error)
      }
      recordError(error, 'analytics.setAnalyticsUserProperties')
    })
}
