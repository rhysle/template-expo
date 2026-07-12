// General analytics events - reusable across all apps built from this template.
// These map to template-level flows: onboarding, paywall, and system errors.
// Do NOT add app-specific events here - put them in analyticsAppEvents.ts instead.
export const AnalyticsGeneralEvents = {
  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',
  ONBOARDING_PAGE_VIEWED: 'onboarding_page_viewed',

  // Paywall
  PAYWALL_VIEWED: 'paywall_viewed',
  PAYWALL_SUBSCRIBE: 'paywall_subscribe',
  PAYWALL_SUBSCRIBE_SUCCESS: 'paywall_subscribe_success',
  PAYWALL_SUBSCRIBE_ERROR: 'paywall_subscribe_error',
  PAYWALL_RESTORE: 'paywall_restore',
  PAYWALL_RESTORE_SUCCESS: 'paywall_restore_success',
  PAYWALL_RESTORE_ERROR: 'paywall_restore_error',
  PAYWALL_DISMISSED: 'paywall_dismissed',

  // Auth (template-ready - wire these when adding authentication to a project)
  SIGN_IN_STARTED: 'sign_in_started',
  SIGN_IN_SUCCESS: 'sign_in_success',
  SIGN_IN_ERROR: 'sign_in_error',
  SIGN_UP_STARTED: 'sign_up_started',
  SIGN_UP_SUCCESS: 'sign_up_success',
  SIGN_UP_ERROR: 'sign_up_error',
  SIGN_OUT: 'sign_out',

  // System
  ERROR_BOUNDARY_TRIGGERED: 'error_boundary_triggered',

  // App Review
  APP_REVIEW_REQUESTED: 'app_review_requested',

  // Auto Paywall
  AUTO_PAYWALL_TRIGGERED: 'auto_paywall_triggered',

  // Settings
  RATE_APP: 'rate_app',
  CONTACT_SUPPORT: 'contact_support',
  SHARE_APP: 'share_app',

  // OTA Updates
  OTA_UPDATE_APPLIED: 'ota_update_applied',
  OTA_UPDATE_AVAILABLE: 'ota_update_available',
  OTA_UPDATE_DOWNLOADED: 'ota_update_downloaded',
  OTA_UPDATE_RESTART: 'ota_update_restart',
} as const
