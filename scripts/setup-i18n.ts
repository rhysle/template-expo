#!/usr/bin/env npx tsx
/**
 * setup-i18n script
 *
 * Reads locale codes from src/i18n/locales/ and updates the expo-localization
 * plugin entry in app.json with a supportedLocales array.
 *
 * Usage:
 *   npx tsx scripts/setup-i18n.ts
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const LOCALES_DIR = path.join(ROOT, 'src/i18n/locales')
const APP_JSON = path.join(ROOT, 'app.json')

type PluginEntry = string | [string, Record<string, unknown>]

function getLocaleCodes(): string[] {
  return fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.basename(f, '.json'))
    .sort()
}

function main() {
  const localeCodes = getLocaleCodes()
  console.log(`Found locale codes: ${localeCodes.join(', ')}`)

  const appJson = JSON.parse(fs.readFileSync(APP_JSON, 'utf-8'))
  const plugins: PluginEntry[] = appJson.expo.plugins

  const idx = plugins.findIndex((p) =>
    Array.isArray(p) ? p[0] === 'expo-localization' : p === 'expo-localization'
  )

  if (idx === -1) {
    console.error('expo-localization plugin entry not found in app.json')
    process.exit(1)
  }

  const existing = plugins[idx]

  if (typeof existing === 'string') {
    plugins[idx] = ['expo-localization', { supportedLocales: localeCodes }]
    console.log('Converted expo-localization from string to array form.')
  } else {
    existing[1].supportedLocales = localeCodes
    console.log('Updated supportedLocales in existing expo-localization config.')
  }

  fs.writeFileSync(APP_JSON, JSON.stringify(appJson, null, 2) + '\n', 'utf-8')
  console.log(
    `app.json updated with supportedLocales: [${localeCodes.map((l) => `"${l}"`).join(', ')}]`
  )
}

main()
