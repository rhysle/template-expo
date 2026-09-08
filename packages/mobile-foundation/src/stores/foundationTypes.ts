import type { AdsSlice } from './features/ads'
import type { AppReviewSlice } from './features/appReview'
import type { OnboardingSlice } from './features/onboarding'
import type { OtaUpdateSlice } from './features/otaUpdate'
import type { PaywallSlice } from './features/paywall'
import type { SnackbarSlice } from './features/snackbar'
import type { SubscriptionSlice } from './features/subscription'
import type { ThemeSlice } from './features/theme'
import type { UserIdentitySlice } from './features/userIdentity'
export interface FoundationSlices {
  otaUpdate: OtaUpdateSlice
  userIdentity: UserIdentitySlice
  onboarding: OnboardingSlice
  ads: AdsSlice
  appReview: AppReviewSlice
  subscription: SubscriptionSlice
  paywall: PaywallSlice
  theme: ThemeSlice
  snackbar: SnackbarSlice
}
