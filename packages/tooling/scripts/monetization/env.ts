import fs from 'node:fs'
import path from 'node:path'

import { getAppContext } from '../app-context'
import { loadStoreEnvironment as loadFastlaneEnvironment } from '../store-environment'
import type { MonetizationConfig, StoreEnvironment } from './types'

const ROOT = getAppContext().appRoot
const APP_CONFIG_PATH = path.join(ROOT, 'app.json')

interface ExpoAppConfig {
  expo?: {
    name?: unknown
    ios?: { bundleIdentifier?: unknown }
    android?: { package?: unknown }
  }
}

export { loadStoreEnvironment as loadFastlaneEnvironment } from '../store-environment'

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

export interface AppIdentifiers {
  appName: string
  bundleIdentifier: string
  packageName: string
}

export const readAppIdentifiers = (): AppIdentifiers => {
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

export const readStoreEnvironment = (
  config: MonetizationConfig,
  options: { revenueCat?: boolean } = {}
): StoreEnvironment => {
  loadFastlaneEnvironment()
  const app = readAppIdentifiers()
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

  if (config.stores.revenueCat && options.revenueCat !== false) {
    environment.revenueCat = {
      projectId: required('REVENUECAT_PROJECT_ID'),
      ...(config.stores.apple ? { bundleIdentifier: app.bundleIdentifier } : {}),
      ...(config.stores.google ? { packageName: app.packageName } : {}),
      apiKey: required('REVENUECAT_API_V2_KEY'),
    }
  }

  return environment
}
