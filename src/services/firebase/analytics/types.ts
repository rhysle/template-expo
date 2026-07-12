import { AnalyticsAppEvents } from './analyticsAppEvents'
import { AnalyticsGeneralEvents } from './analyticsGeneralEvents'

// Unified event name type covering both generic (template) and app-specific events.
// analyticsService.ts imports from here to avoid a circular dependency with index.ts.
export type AnalyticsEventName =
  | (typeof AnalyticsGeneralEvents)[keyof typeof AnalyticsGeneralEvents]
  | (typeof AnalyticsAppEvents)[keyof typeof AnalyticsAppEvents]
