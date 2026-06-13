import { useTranslation } from 'react-i18next'

import { usePreferencesState } from '@/stores/features/preferences'

interface FormatNumberOptions {
  decimals?: number
  minDecimals?: number
}

/**
 * Format a number with locale-aware thousand/decimal separators.
 *
 * @param value     The numeric value to format.
 * @param locale    BCP-47 locale tag (e.g. `'en'`, `'vi'`).
 * @param options   Optional fraction-digit overrides.
 * @returns         Locale-formatted string, or `'--'` for non-finite values.
 */
export const formatNumber = (
  value: number,
  locale: string,
  options: FormatNumberOptions = {}
): string => {
  if (!Number.isFinite(value)) return '--'

  const { decimals = 2, minDecimals } = options

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: minDecimals ?? 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Returns the decimal separator character for a given locale.
 * e.g. `'.'` for `'en'`, `','` for `'vi'`.
 */
export const getDecimalSeparator = (locale: string): string => {
  const formatted = new Intl.NumberFormat(locale).format(1.1)
  // The formatted string for 1.1 is e.g. "1.1" or "1,1" - grab the non-digit char
  return formatted.replace(/\d/g, '') || '.'
}

/**
 * Hook that returns locale-bound number formatters based on the current
 * i18n language.
 */
export const useNumberFormat = () => {
  const { i18n } = useTranslation()
  const locale: string = i18n.language
  const { decimalDigits } = usePreferencesState()

  return {
    /** Format a converted amount using the user's configured decimal digits preference. */
    formatAmount: (value: number) => formatNumber(value, locale, { decimals: decimalDigits }),

    /** Format an exchange rate (up to 4 decimal places). */
    formatRate: (value: number | null) =>
      value !== null ? formatNumber(value, locale, { decimals: 4 }) : '--',

    /** The locale-specific decimal separator character (e.g. `'.'` or `','`). */
    decimalSeparator: getDecimalSeparator(locale),

    /** The raw locale string for passing to utility functions. */
    locale,
  }
}

/**
 * Format a math expression string for display, adding locale-aware thousand/decimal
 * separators to each numeric segment while preserving operators and trailing dots.
 *
 * e.g. `"1000.3+200"` → `"1,000.3+200"` (en locale)
 */
export const formatExpression = (
  expression: string,
  locale: string,
  decimalSep: string
): string => {
  return expression.replace(/(\d+)(\.\d*)?/g, (match, _intPart, decPart: string | undefined) => {
    const num = parseFloat(match)
    if (!Number.isFinite(num)) return match
    const decimalDigits = decPart && decPart.length > 1 ? Math.min(decPart.length - 1, 20) : 0
    const hasTrailingDot = decPart === '.'
    const formatted = formatNumber(num, locale, { decimals: decimalDigits })
    return hasTrailingDot ? formatted + decimalSep : formatted
  })
}
