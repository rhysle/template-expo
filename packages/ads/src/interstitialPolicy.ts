export interface InterstitialPolicyState {
  qualifyingCompletionsSinceLastAd: number
  lastShownAt: number | null
  shownThisForeground: boolean
}

export interface InterstitialPolicyConfig {
  initialGraceCompletions: number
  completionsBetweenAds: number
  cooldownMs: number
}

export const getInterstitialEligibility = (
  state: InterstitialPolicyState,
  config: InterstitialPolicyConfig,
  now: number
): boolean => {
  if (
    state.lastShownAt === null &&
    state.qualifyingCompletionsSinceLastAd <= config.initialGraceCompletions
  ) {
    return false
  }

  if (
    state.lastShownAt !== null &&
    state.qualifyingCompletionsSinceLastAd < config.completionsBetweenAds
  ) {
    return false
  }

  if (state.lastShownAt !== null && now - state.lastShownAt < config.cooldownMs) {
    return false
  }

  if (state.shownThisForeground) {
    return false
  }

  return true
}
