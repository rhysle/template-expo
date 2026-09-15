import fs from 'node:fs'
import path from 'node:path'

import { getAppContext } from './app-context'

export const sharedStoreKeys = [
  'APP_STORE_CONNECT_API_KEY_KEY_ID',
  'APP_STORE_CONNECT_API_KEY_ISSUER_ID',
  'APP_STORE_CONNECT_API_KEY_KEY_FILEPATH',
  'GOOGLE_PLAY_JSON_KEY_PATH',
  'APPLE_ID',
  'APPLE_TEAM_ID',
  'ITC_TEAM_ID',
] as const
export const appStoreKeys = ['REVENUECAT_PROJECT_ID', 'REVENUECAT_API_V2_KEY'] as const
export const parseEnvironment = (source: string): Record<string, string> => {
  const values: Record<string, string> = {}
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(trimmed)
    if (!match) throw new Error('Invalid environment declaration')
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1)
    values[match[1]] = value
  }
  return values
}
export const loadStoreEnvironment = (): void => {
  const { appRoot, repoRoot } = getAppContext()
  const sources = [
    [repoRoot, sharedStoreKeys],
    [appRoot, appStoreKeys],
  ] as const
  // Validate both files before touching the process environment.
  const parsed = sources.map(([root, allowed]) => {
    const file = path.join(root, '.env.fastlane.local')
    const values = fs.existsSync(file) ? parseEnvironment(fs.readFileSync(file, 'utf8')) : {}
    for (const key of Object.keys(values)) {
      if (!(allowed as readonly string[]).includes(key))
        throw new Error(`${key} is not allowed in ${file}`)
    }
    return values
  })
  for (const values of parsed)
    for (const [key, value] of Object.entries(values)) process.env[key] ??= value
  for (const key of ['APP_STORE_CONNECT_API_KEY_KEY_FILEPATH', 'GOOGLE_PLAY_JSON_KEY_PATH']) {
    const value = process.env[key]?.trim()
    if (value) process.env[key] = path.resolve(repoRoot, value)
  }
}
