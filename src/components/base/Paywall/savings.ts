import type { PurchasesPackage } from 'react-native-purchases'

export type PeriodKey = 'day' | 'week' | 'month' | 'year'

const periodUnitToKey: Record<string, PeriodKey> = {
  D: 'day',
  W: 'week',
  M: 'month',
  Y: 'year',
}

const unitsPerYear: Record<PeriodKey, number> = {
  day: 365,
  week: 52,
  month: 12,
  year: 1,
}

const PERIOD_REGEX = /^P(\d+)([DWMY])$/

interface ParsedPeriod {
  key: PeriodKey
  count: number
}

const parseSubscriptionPeriod = (period?: string | null): ParsedPeriod | undefined => {
  if (!period) return undefined
  const match = period.match(PERIOD_REGEX)
  if (!match) return undefined
  const key = periodUnitToKey[match[2]]
  const count = Number(match[1])
  if (!key || !Number.isFinite(count) || count <= 0) return undefined
  return { key, count }
}

export const getPeriodKey = (period?: string | null): PeriodKey | undefined =>
  parseSubscriptionPeriod(period)?.key

const yearlyEquivalentPrice = (pkg: PurchasesPackage): number | undefined => {
  const parsed = parseSubscriptionPeriod(pkg.product.subscriptionPeriod)
  if (!parsed) return undefined
  return (pkg.product.price * unitsPerYear[parsed.key]) / parsed.count
}

const MIN_DISPLAYED_SAVINGS_PERCENT = 10

export const computeYearlySavingsPercent = (
  pkg: PurchasesPackage,
  allPackages: PurchasesPackage[]
): number | undefined => {
  if (getPeriodKey(pkg.product.subscriptionPeriod) !== 'year') return undefined

  const baselines = allPackages
    .filter((p) => {
      const key = getPeriodKey(p.product.subscriptionPeriod)
      return key === 'week' || key === 'month'
    })
    .map(yearlyEquivalentPrice)
    .filter((price): price is number => price !== undefined && price > 0)

  if (baselines.length === 0) return undefined

  const referenceYearly = Math.min(...baselines)
  const savings = 1 - pkg.product.price / referenceYearly
  if (savings <= 0) return undefined

  const rounded = Math.round(savings * 100)
  if (rounded < MIN_DISPLAYED_SAVINGS_PERCENT) return undefined

  return rounded
}
