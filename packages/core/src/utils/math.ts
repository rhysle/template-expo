export const evaluateMath = (expression: string): number | null => {
  try {
    // Remove all whitespace
    const exp = expression.replace(/\s+/g, '')
    if (!exp) return null

    // Prevent trailing operators or decimal points
    if (/[+\-*/.]$/.test(exp)) return null

    // Prevent consecutive operators (except maybe negative numbers, but for a simple numpad we can restrict)
    if (/[+\-*/]{2,}/.test(exp)) return null

    // Strictly whitelist characters: only digits, fundamental operators, and decimal points
    if (!/^[\d+\-*/.]+$/.test(exp)) return null

    // Since the string strictly only contains digits and math operators, it's safe to evaluate
    const result = new Function(`return ${exp}`)() as number

    return Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}
