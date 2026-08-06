import fs from 'node:fs'
import path from 'node:path'

import type {
  GoogleMoney,
  MonetizationConfig,
  PppSnapshot,
  RegionalPricingAssignment,
} from './types'

const DATA_ROOT = path.resolve(__dirname, 'data')

export const decimalToCents = (value: string): bigint => {
  const match = /^(\d+)\.(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid USD price: ${value}`)
  return BigInt(match[1]) * 100n + BigInt(match[2])
}

const appleUsdPriceToCents = (value: string): bigint => {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) throw new Error(`Invalid Apple USD price point: ${value}`)
  const fraction = match[2] ?? ''
  if (fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) {
    throw new Error(`Apple USD price point has sub-cent precision: ${value}`)
  }
  return BigInt(match[1]) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, '0'))
}

export const selectClosestUsdPrice = <T extends { attributes: { customerPrice: string } }>(
  targetUsd: string,
  points: readonly T[]
): T => {
  const target = decimalToCents(targetUsd)
  const sorted = [...points].sort((left, right) => {
    const leftPrice = appleUsdPriceToCents(left.attributes.customerPrice)
    const rightPrice = appleUsdPriceToCents(right.attributes.customerPrice)
    const leftDistance = leftPrice > target ? leftPrice - target : target - leftPrice
    const rightDistance = rightPrice > target ? rightPrice - target : target - rightPrice
    if (leftDistance !== rightDistance) return leftDistance < rightDistance ? -1 : 1
    return leftPrice < rightPrice ? -1 : leftPrice > rightPrice ? 1 : 0
  })
  const selected = sorted[0]
  if (!selected) throw new Error(`No store price points are available for $${targetUsd}`)
  return selected
}

export const adjustedPriceUsd = (priceUsd: string, multiplier: number): string => {
  const multiplierTenths = BigInt(Math.round(multiplier * 10))
  const tenthsOfCents = decimalToCents(priceUsd) * multiplierTenths
  const cents = (tenthsOfCents + 5n) / 10n
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

export const selectNearestBand = (ratio: number, bands: readonly number[]): number => {
  let selected = bands[0]
  let distance = Math.abs(ratio - selected)
  for (const band of bands.slice(1)) {
    const nextDistance = Math.abs(ratio - band)
    if (nextDistance < distance) {
      selected = band
      distance = nextDistance
    }
  }
  return selected
}

export const loadPppSnapshot = (dataset: string): PppSnapshot => {
  const filepath = path.join(DATA_ROOT, `${dataset}.json`)
  if (!fs.existsSync(filepath)) {
    throw new Error(`PPP dataset ${dataset} is missing at ${filepath}`)
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8')) as PppSnapshot
}

export class RegionalPricingResolver {
  readonly snapshot?: PppSnapshot
  private readonly byIso2 = new Map<string, RegionalPricingAssignment>()
  private readonly byIso3 = new Map<string, RegionalPricingAssignment>()

  constructor(private readonly config: MonetizationConfig) {
    if (config.regionalPricing.strategy === 'store-equalized') return
    this.snapshot = loadPppSnapshot(config.regionalPricing.dataset)
    if (this.snapshot.id !== config.regionalPricing.dataset) {
      throw new Error(
        `PPP dataset ID ${this.snapshot.id} does not match config ${config.regionalPricing.dataset}`
      )
    }
    for (const country of this.snapshot.countries) {
      const override = config.regionalPricing.countryOverrides[country.iso2]
      const assignment: RegionalPricingAssignment = {
        iso2: country.iso2,
        iso3: country.iso3,
        countryName: country.name,
        sourceYear: country.sourceYear,
        rawRatio: country.normalizedRatio,
        multiplier:
          country.iso2 === 'US'
            ? 1
            : (override ??
              selectNearestBand(country.normalizedRatio, config.regionalPricing.bands)),
        overridden: override !== undefined,
        fallback: false,
      }
      this.byIso2.set(country.iso2, assignment)
      this.byIso3.set(country.iso3, assignment)
    }
  }

  forGoogle(regionCode: string): RegionalPricingAssignment {
    return this.resolve(this.byIso2.get(regionCode), regionCode === 'US')
  }

  forApple(territoryId: string): RegionalPricingAssignment {
    return this.resolve(this.byIso3.get(territoryId), territoryId === 'USA')
  }

  usedMultipliers(assignments: Iterable<RegionalPricingAssignment>): number[] {
    return [...new Set([...assignments].map((item) => item.multiplier))].sort((a, b) => a - b)
  }

  private resolve(
    assignment: RegionalPricingAssignment | undefined,
    isUnitedStates: boolean
  ): RegionalPricingAssignment {
    if (this.config.regionalPricing.strategy === 'store-equalized' || isUnitedStates) {
      return { multiplier: 1, overridden: false, fallback: false }
    }
    return assignment ?? { multiplier: 1, overridden: false, fallback: true }
  }
}

export const moneyToNanos = (money: GoogleMoney): bigint =>
  BigInt(money.units || '0') * 1_000_000_000n + BigInt(money.nanos || 0)

export const moneyEquals = (left: GoogleMoney, right: GoogleMoney): boolean =>
  left.currencyCode === right.currencyCode && moneyToNanos(left) === moneyToNanos(right)

export const formatMoney = (money: GoogleMoney): string => {
  const numeric = Number(money.units || '0') + Number(money.nanos || 0) / 1_000_000_000
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currencyCode,
    currencyDisplay: 'narrowSymbol',
  }).format(numeric)
}

export const validateMoneyPrecision = (money: GoogleMoney): void => {
  const digits = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currencyCode,
  }).resolvedOptions().maximumFractionDigits
  const quantum = 10n ** BigInt(9 - digits)
  if (moneyToNanos(money) % quantum !== 0n) {
    throw new Error(
      `Google returned invalid ${money.currencyCode} minor-unit precision: ${formatMoney(money)}`
    )
  }
}
