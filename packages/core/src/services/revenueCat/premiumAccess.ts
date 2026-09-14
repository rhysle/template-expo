export type PaywallSource = string

export const buildPaywallPath = (source: PaywallSource) =>
  ({ pathname: '/paywall', params: { source } }) as const

export const shouldTriggerAutoPaywall = (
  enabledAt: number | null,
  lastShownAt: number | null,
  intervalMs: number,
  now = Date.now()
) => {
  if (enabledAt === null) return false
  return now - (lastShownAt ?? enabledAt) >= intervalMs
}

export const hasPaywallPrecedence = (
  isPaywallShowing: boolean,
  enabledAt: number | null,
  lastShownAt: number | null,
  intervalMs: number,
  now = Date.now()
) => isPaywallShowing || shouldTriggerAutoPaywall(enabledAt, lastShownAt, intervalMs, now)
