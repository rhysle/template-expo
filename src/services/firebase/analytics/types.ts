import { AppAnalyticsEvents } from './analyticsAppEvents'
import { AnalyticsEvents } from './analyticsEvents'

// Unified event name type covering both generic (template) and app-specific events.
// analyticsService.ts imports from here to avoid a circular dependency with index.ts.
export type AnalyticsEventName =
  | (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]
  | (typeof AppAnalyticsEvents)[keyof typeof AppAnalyticsEvents]
