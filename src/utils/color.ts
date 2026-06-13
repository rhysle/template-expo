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
