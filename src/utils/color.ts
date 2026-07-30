/**
 * Applies an alpha value to a hex color string, returning an rgba() string.
 * Falls back to the original value if it cannot be parsed as hex.
 */
export const withAlpha = (hex: string, alpha: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return hex
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null

  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] as const
}

/**
 * Mixes two six-digit hex colors. `amount` is the share of `toHex` in the result.
 * Returns `fromHex` unchanged when either color cannot be parsed.
 */
export const mixHexColors = (fromHex: string, toHex: string, amount: number): string => {
  const from = hexToRgb(fromHex)
  const to = hexToRgb(toHex)
  if (!from || !to) return fromHex

  const boundedAmount = Math.min(Math.max(amount, 0), 1)
  const channels = from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * boundedAmount)
  )

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}
