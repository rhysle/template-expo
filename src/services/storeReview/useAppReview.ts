import { AppConfig } from '@/configs'
import { trackEvent } from '@/services/firebase/analytics'
import { AnalyticsGeneralEvents } from '@/services/firebase/analytics/analyticsGeneralEvents'
import { recordError } from '@/services/sentry'
import { useAppReviewState } from '@/stores/features/appReview'

import { isReviewAvailable, requestStoreReview } from './storeReviewService'

export const useAppReview = () => {
  const {
    appReviewActionCount,
    appReviewLastRequestedAt,
    incrementActionCount,
    recordReviewRequested,
  } = useAppReviewState()

  /** Returns true only when a native review request was dispatched. */
  const requestReview = async (): Promise<boolean> => {
    const nextCount = appReviewActionCount + 1
    incrementActionCount()

    const meetsCount = nextCount >= AppConfig.appReview.minActionsBeforeRequest
    const daysSinceLast =
      appReviewLastRequestedAt !== null
        ? (Date.now() - appReviewLastRequestedAt) / (1000 * 60 * 60 * 24)
        : Infinity
    const meetsDays = daysSinceLast >= AppConfig.appReview.minDaysBetweenRequests

    if (!meetsCount || !meetsDays) return false

    try {
      const available = await isReviewAvailable()
      if (!available) return false

      await requestStoreReview()
      recordReviewRequested()
      trackEvent(AnalyticsGeneralEvents.APP_REVIEW_REQUESTED)
      return true
    } catch (error) {
      recordError(error)
      return false
    }
  }

  return { requestReview }
}
