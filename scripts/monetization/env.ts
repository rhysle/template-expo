import fs from 'node:fs'
import path from 'node:path'

import type { MonetizationConfig, StoreEnvironment } from './types'

const ROOT = path.resolve(__dirname, '../..')
const ENV_PATH = path.join(ROOT, '.env.fastlane.local')
const APP_CONFIG_PATH = path.join(ROOT, 'app.json')

interface ExpoAppConfig {
  expo?: {
    name?: unknown
    ios?: { bundleIdentifier?: unknown }
    android?: { package?: unknown }
  }
}

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const separator = trimmed.indexOf('=')
  if (separator === -1) return null

  const key = trimmed.slice(0, separator).trim()
  let value = trimmed.slice(separator + 1).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return [key, value]
}

export const loadFastlaneEnvironment = (): void => {
  if (!fs.existsSync(ENV_PATH)) return

  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (!parsed) continue
    const [key, value] = parsed
    process.env[key] ??= value
  }
}

const required = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}. Add it to .env.fastlane.local.`)
  return value
}

const resolveProjectPath = (value: string): string =>
  path.isAbsolute(value) ? value : path.resolve(ROOT, value)

const appConfigValue = (value: unknown, location: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing ${location} in app.json.`)
  }
  return value.trim()
}

const readExpoAppConfig = (): {
  appName: string
  bundleIdentifier: string
  packageName: string
} => {
  const parsed = JSON.parse(fs.readFileSync(APP_CONFIG_PATH, 'utf8')) as ExpoAppConfig
  return {
    appName: appConfigValue(parsed.expo?.name, 'expo.name'),
    bundleIdentifier: appConfigValue(
      parsed.expo?.ios?.bundleIdentifier,
      'expo.ios.bundleIdentifier'
    ),
    packageName: appConfigValue(parsed.expo?.android?.package, 'expo.android.package'),
  }
}

export const readStoreEnvironment = (config: MonetizationConfig): StoreEnvironment => {
  loadFastlaneEnvironment()
  const app = readExpoAppConfig()
  const environment: StoreEnvironment = { appName: app.appName }

  if (config.stores.apple) {
    const keyFilepath = resolveProjectPath(required('APP_STORE_CONNECT_API_KEY_KEY_FILEPATH'))
    if (!fs.existsSync(keyFilepath)) {
      throw new Error(`App Store Connect API key not found: ${keyFilepath}`)
    }
    environment.apple = {
      bundleIdentifier: app.bundleIdentifier,
      issuerId: required('APP_STORE_CONNECT_API_KEY_ISSUER_ID'),
      keyId: required('APP_STORE_CONNECT_API_KEY_KEY_ID'),
      keyFilepath,
    }
  }

  if (config.stores.google) {
    const jsonKeyPath = resolveProjectPath(required('GOOGLE_PLAY_JSON_KEY_PATH'))
    if (!fs.existsSync(jsonKeyPath)) {
      throw new Error(`Google Play service-account key not found: ${jsonKeyPath}`)
    }
    const packageName = app.packageName
    if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) {
      throw new Error('expo.android.package in app.json is not a valid Android package name.')
    }
    environment.google = {
      packageName,
      jsonKeyPath,
    }
  }

  if (config.stores.revenueCat) {
    environment.revenueCat = {
      projectId: required('REVENUECAT_PROJECT_ID'),
      ...(config.stores.apple ? { bundleIdentifier: app.bundleIdentifier } : {}),
      ...(config.stores.google ? { packageName: app.packageName } : {}),
      apiKey: required('REVENUECAT_API_V2_KEY'),
    }
  }

  return environment
}
