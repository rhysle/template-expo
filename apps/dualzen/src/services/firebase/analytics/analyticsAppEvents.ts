// App-specific analytics events for this app.
// Keep this intentionally small: these events describe the core capture funnel,
// not every camera control interaction.
export const AnalyticsAppEvents = {
  CAPTURE_STARTED: 'capture_started',
  CAPTURE_COMPLETED: 'capture_completed',
  CAPTURE_FAILED: 'capture_failed',
  CAMERA_SESSION_FAILED: 'camera_session_failed',
  MEDIA_EXPORT_COMPLETED: 'media_export_completed',
  MEDIA_EXPORT_FAILED: 'media_export_failed',
  MEDIA_SHARE_REQUESTED: 'media_share_requested',
  MEDIA_SHARE_FAILED: 'media_share_failed',
  PROJECTS_CLEARED: 'projects_cleared',
  PROJECTS_CLEAR_FAILED: 'projects_clear_failed',
} as const
