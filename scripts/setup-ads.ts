#!/usr/bin/env npx tsx
/**
 * Ads setup script
 *
 * Reads AppConfig.ads.enabled and syncs package.json + app.json accordingly:
 *   - enabled: true  → removes react-native-google-mobile-ads and expo-tracking-transparency
 *                       from autolinking exclude (package.json), adds/updates both native
 *                       plugins (app.json)
 *   - enabled: false → adds both packages to autolinking exclude (package.json), removes
 *                       both native plugins (app.json)
 *
 * Usage:
 *   npm run setup:ads
 *
 * Run this after changing AppConfig.ads.enabled, then run:
 *   npx expo prebuild --clean
 */

import fs from 'fs'
import path from 'path'

import { AppConfig } from '../src/configs'

const ROOT = path.resolve(__dirname, '..')
const ADS_PACKAGE = 'react-native-google-mobile-ads'
const ATT_PACKAGE = 'expo-tracking-transparency'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PackageJson {
  expo?: {
    autolinking?: {
      ios?: { exclude?: string[] }
      android?: { exclude?: string[] }
    }
  }
  [key: string]: unknown
}

interface AppJson {
  expo: {
    plugins?: unknown[]
    [key: string]: unknown
  }
}

// ── Autolinking (package.json) ────────────────────────────────────────────────

function updateAutolinkingExclude(packageJson: PackageJson, enabled: boolean): void {
  if (!packageJson.expo) packageJson.expo = {}
  if (!packageJson.expo.autolinking) packageJson.expo.autolinking = {}

  const autolinking = packageJson.expo.autolinking

  for (const platform of ['ios', 'android'] as const) {
    if (!autolinking[platform]) autolinking[platform] = {}

    const platformConfig = autolinking[platform]!
    if (!platformConfig.exclude) platformConfig.exclude = []

    for (const pkg of [ADS_PACKAGE, ATT_PACKAGE]) {
      const excludeList: string[] = platformConfig.exclude!
      const alreadyExcluded = excludeList.includes(pkg)

      if (!enabled && !alreadyExcluded) {
        excludeList.push(pkg)
        console.log(`  + Added ${pkg} to expo.autolinking.${platform}.exclude`)
      } else if (enabled && alreadyExcluded) {
        platformConfig.exclude = excludeList.filter((p: string) => p !== pkg)
        console.log(`  - Removed ${pkg} from expo.autolinking.${platform}.exclude`)
      } else {
        console.log(`  ✓ expo.autolinking.${platform}.exclude already correct for ${pkg}`)
      }
    }
  }
}

// ── Ads native plugin (app.json) ──────────────────────────────────────────────

function updateAdsPlugin(appJson: AppJson, enabled: boolean): void {
  if (!appJson.expo.plugins) appJson.expo.plugins = []

  const plugins = appJson.expo.plugins
  const pluginIndex = plugins.findIndex(
    (p) => p === ADS_PACKAGE || (Array.isArray(p) && p[0] === ADS_PACKAGE)
  )

  if (enabled) {
    const { ios, android } = AppConfig.ads
    const pluginEntry = [
      ADS_PACKAGE,
      {
        androidAppId: android.appId,
        iosAppId: ios.appId,
        // userTrackingUsageDescription is managed by expo-tracking-transparency plugin
        delayAppMeasurementInit: true,
      },
    ]

    if (pluginIndex !== -1) {
      plugins[pluginIndex] = pluginEntry
      console.log(`  ✏  Updated ${ADS_PACKAGE} plugin in app.json`)
    } else {
      plugins.push(pluginEntry)
      console.log(`  + Added ${ADS_PACKAGE} plugin to app.json`)
    }
  } else {
    if (pluginIndex !== -1) {
      plugins.splice(pluginIndex, 1)
      console.log(`  - Removed ${ADS_PACKAGE} plugin from app.json`)
    } else {
      console.log(`  ✓ No ${ADS_PACKAGE} plugin to remove from app.json`)
    }
  }
}

// ── ATT native plugin (app.json) ──────────────────────────────────────────────

function updateAttPlugin(appJson: AppJson, enabled: boolean): void {
  if (!appJson.expo.plugins) appJson.expo.plugins = []

  const plugins = appJson.expo.plugins
  const pluginIndex = plugins.findIndex(
    (p) => p === ATT_PACKAGE || (Array.isArray(p) && p[0] === ATT_PACKAGE)
  )

  if (enabled) {
    const pluginEntry = [
      ATT_PACKAGE,
      {
        userTrackingPermission:
          'This identifier will be used to deliver personalized ads to you.',
      },
    ]

    if (pluginIndex !== -1) {
      plugins[pluginIndex] = pluginEntry
      console.log(`  ✏  Updated ${ATT_PACKAGE} plugin in app.json`)
    } else {
      plugins.push(pluginEntry)
      console.log(`  + Added ${ATT_PACKAGE} plugin to app.json`)
    }
  } else {
    if (pluginIndex !== -1) {
      plugins.splice(pluginIndex, 1)
      console.log(`  - Removed ${ATT_PACKAGE} plugin from app.json`)
    } else {
      console.log(`  ✓ No ${ATT_PACKAGE} plugin to remove from app.json`)
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const { enabled } = AppConfig.ads
  const status = enabled ? 'ENABLED' : 'DISABLED'

  console.log(`\nAds: ${status}`)
  console.log('Updating package.json and app.json...\n')

  const packageJsonPath = path.join(ROOT, 'package.json')
  const appJsonPath = path.join(ROOT, 'app.json')

  const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const appJson: AppJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'))

  updateAutolinkingExclude(packageJson, enabled)
  updateAdsPlugin(appJson, enabled)
  updateAttPlugin(appJson, enabled)

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n')

  console.log('\nFiles updated.')

  if (enabled) {
    console.log('\nAds enabled. Next steps:')
    console.log('  1. Fill in ad unit IDs in AppConfig.ads.ios / AppConfig.ads.android')
    console.log('  2. Fill in App IDs in AppConfig.ads.ios.appId / AppConfig.ads.android.appId')
    console.log('  3. Add useAdsInit() call in src/app/_layout.tsx inside RootLayout')
    console.log('  4. Add useConsentInit() call in src/app/(tabs)/_layout.tsx inside TabLayout')
    console.log('  5. Run: npx expo prebuild --clean')
  } else {
    console.log('\nAds disabled. Next steps:')
    console.log('  1. Remove useAdsInit() call from src/app/_layout.tsx (if present)')
    console.log('  2. Remove useConsentInit() call from src/app/(tabs)/_layout.tsx (if present)')
    console.log('  3. Run: npx expo prebuild --clean')
  }

  console.log('')
}

main()
