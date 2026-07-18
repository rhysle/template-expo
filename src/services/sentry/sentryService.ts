import type { Breadcrumb, Event } from '@sentry/react-native'
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

const OFFLINE_SDK_REQUEST_ERROR_PATTERNS = [
  /^Error making request\.?$/i,
  /^Error performing request\.?$/i,
  /^The server timed out\.?$/i,
]

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message?: unknown }
    if (typeof message === 'string') return message
  }
  return String(error)
}

const isNetworkError = (error: unknown): boolean => {
  const message = getErrorMessage(error)
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

const getEventErrorMessages = (event: Event): string[] => {
  const exceptionMessages =
    event.exception?.values
      ?.flatMap((exception) => [exception.value, exception.type])
      .filter((value): value is string => typeof value === 'string') ?? []

  return [event.message, ...exceptionMessages].filter(
    (value): value is string => typeof value === 'string'
  )
}

const isExpectedOfflineSdkRequestError = (event: Event): boolean => {
  const device = event.contexts?.device as { online?: unknown } | undefined
  if (device?.online !== false) return false

  return getEventErrorMessages(event).some((message) =>
    OFFLINE_SDK_REQUEST_ERROR_PATTERNS.some((pattern) => pattern.test(message))
  )
}

export const initSentry = (): void => {
  Sentry.init({
    dsn: AppConfig.sentry.dsn,
    enabled: !__DEV__,
    environment: process.env.APP_VARIANT ?? (__DEV__ ? 'development' : 'production'),
    tracesSampleRate: 0, // performance monitoring off; enable when ready
    beforeSend: (event, hint) => {
      const err = hint?.originalException
      if (err instanceof OfflineError) return null
      if (isNetworkError(err)) return null
      if (isExpectedOfflineSdkRequestError(event)) return null
      return event
    },
  })
}

// ── Error tracking ────────────────────────────────────────────────────────────

/**
 * Record a caught JS error.
 * `context` is added as a breadcrumb before the exception so it appears in
 * the Sentry issue log - useful for diagnosing what triggered the error.
 * `details` is attached only to this event as structured diagnostic context.
 */
export const recordError = (
  error: unknown,
  context?: string,
  details?: Record<string, unknown>
): void => {
  if (__DEV__) {
    const prefix = `[recordError]${context ? ` (${context})` : ''}`
    const stack = error instanceof Error ? error.stack : String(error)
    console.warn(`${prefix}\n${stack}`)
  }
  if (context) {
    Sentry.addBreadcrumb({ message: context, level: 'error' })
  }
  const exception = error instanceof Error ? error : new Error(String(error))

  if (!details) {
    Sentry.captureException(exception)
    return
  }

  Sentry.withScope((scope) => {
    scope.setContext('error_details', details)
    Sentry.captureException(exception)
  })
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
