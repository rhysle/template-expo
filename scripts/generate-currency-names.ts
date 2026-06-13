/**
 * Generates pre-translated currency names for all supported locales
 * using Node's built-in Intl.DisplayNames, then merges them into
 * each locale JSON file under the `currencies` key.
 *
 * Run: npx tsx scripts/generate-currency-names.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { CURRENCY_CODES } from '../src/constants/currencyCodes'

const LOCALES_DIR = join(process.cwd(), 'src/i18n/locales')

const locales = readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''))

for (const locale of locales) {
  const displayNames = new Intl.DisplayNames([locale], { type: 'currency' })
  const currencies: Record<string, string> = {}

  for (const code of CURRENCY_CODES) {
    // Fall back to the code itself so all locales always have the same key set
    currencies[code] = displayNames.of(code) ?? code
  }

  const filePath = join(LOCALES_DIR, `${locale}.json`)
  const existing = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
  existing.currencies = currencies

  writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
  console.log(`✓ ${locale} (${Object.keys(currencies).length} currencies)`)
}

console.log('\nUpdated all locale files.')
