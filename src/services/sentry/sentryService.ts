import type { Breadcrumb } from '@sentry/react-native'
import * as Sentry from '@sentry/react-native'

import { AppConfig } from '@/configs'
import { OfflineError } from '@/utils/OfflineError'

// ── Initialisation ────────────────────────────────────────────────────────────

/**
 * Call once at module level before the React tree renders.
 * Disabled in dev - JS errors are visible in Metro, use Spotlight for local testing.
 */
const NETWORK_ERROR_PATTERNS = [
  /network request failed/i,
  /failed to fetch/i,
  /networkerror/i,
  /the internet connection appears to be offline/i, // iOS system message
  /could not connect to the server/i, // Android system message
]

const isNetworkError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

export const initSentry = (): void => {
  Sentry.init({
    dsn: AppConfig.sentry.dsn,
    enabled: !__DEV__,
    environment: process.env.APP_VARIANT ?? 'production',
    tracesSampleRate: 0, // performance monitoring off; enable when ready
    beforeSend: (event, hint) => {
      const err = hint?.originalException
      if (err instanceof OfflineError) return null
      if (isNetworkError(err)) return null
      return event
    },
  })
}

// ── Error tracking ────────────────────────────────────────────────────────────

/**
 * Record a caught JS error.
 * `context` is added as a breadcrumb before the exception so it appears in
 * the Sentry issue log - useful for diagnosing what triggered the error.
 */
export const recordError = (error: unknown, context?: string): void => {
  if (__DEV__) {
    const prefix = `[recordError]${context ? ` (${context})` : ''}`
    const stack = error instanceof Error ? error.stack : String(error)
    console.warn(`${prefix}\n${stack}`)
    return
  }
  if (context) {
    Sentry.addBreadcrumb({ message: context, level: 'error' })
  }
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)))
}

/**
 * Add a breadcrumb log entry.
 * Call before key user operations so the Sentry issue log shows
 * what the user was doing before a crash.
 *
 * @example
 * logBreadcrumb('User tapped convert', { category: 'ui.click', data: { from: 'USD', to: 'EUR' } })
 * logBreadcrumb('API request failed', { category: 'http', level: 'warning', data: { url, status } })
 * logBreadcrumb('User signed in', { category: 'auth' })
 */
export const logBreadcrumb = (
  message: string,
  options: Omit<Breadcrumb, 'message' | 'timestamp'> = {}
): void => {
  Sentry.addBreadcrumb({ message, level: 'info', ...options })
}

/** Associate events with a user account. Pass null to clear on logout. */
export const setSentryUser = (userId: string | null): void => {
  Sentry.setUser(userId ? { id: userId } : null)
}

/** Attach arbitrary key-value metadata to error reports. */
export const setSentryTag = (key: string, value: string): void => {
  Sentry.setTag(key, value)
}
