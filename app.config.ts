import { ConfigContext, ExpoConfig } from 'expo/config'
import { existsSync } from 'fs'

import {
  getVariantDisplayName,
  getVariantIdentifier,
  resolveAppVariant,
} from './scripts/app-variant'

const DEVELOPMENT_ANDROID_FIREBASE_CONFIG = './google-services.dev.json'
const DEVELOPMENT_IOS_FIREBASE_CONFIG = './GoogleService-Info.dev.plist'
const PRODUCTION_ANDROID_FIREBASE_CONFIG = './google-services.json'
const PRODUCTION_IOS_FIREBASE_CONFIG = './GoogleService-Info.plist'

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveAppVariant()
  const isProd = variant === 'production'
  const baseName = config.name!
  const baseIosBundleIdentifier = config.ios!.bundleIdentifier!
  const baseAndroidPackage = config.android!.package!
  const baseScheme = config.scheme as string
  // Production EAS builds receive Firebase config through project-scoped Sensitive file
  // variables. Local development always uses the shared development Firebase project files
  // downloaded by `npm run setup:firebase`.
  const googleServicesJsonPath = isProd
    ? (process.env.GOOGLE_SERVICES_JSON ?? PRODUCTION_ANDROID_FIREBASE_CONFIG)
    : DEVELOPMENT_ANDROID_FIREBASE_CONFIG
  const googleServiceInfoPlistPath = isProd
    ? (process.env.GOOGLE_SERVICE_INFO_PLIST ?? PRODUCTION_IOS_FIREBASE_CONFIG)
    : DEVELOPMENT_IOS_FIREBASE_CONFIG

  if (!existsSync(googleServicesJsonPath)) {
    console.warn(
      `\n⚠️  Firebase Android config not found at ${googleServicesJsonPath}.\n` +
        '   Run `npm run setup:firebase` before prebuilding the native app.\n'
    )
  }
  if (!existsSync(googleServiceInfoPlistPath)) {
    console.warn(
      `\n⚠️  Firebase iOS config not found at ${googleServiceInfoPlistPath}.\n` +
        '   Run `npm run setup:firebase` before prebuilding the native app.\n'
    )
  }

  return {
    ...config,
    name: getVariantDisplayName(baseName, variant),
    scheme: getVariantIdentifier(baseScheme, variant),
    ios: {
      ...config.ios,
      bundleIdentifier: getVariantIdentifier(baseIosBundleIdentifier, variant),
      googleServicesFile: googleServiceInfoPlistPath,
      infoPlist: {
        ...config.ios?.infoPlist,
        ...(variant === 'development' && {
          // For Firebase emulator debugging from real devices (dev only)
          NSAppTransportSecurity: {
            NSAllowsLocalNetworking: true,
            NSAllowsArbitraryLoads: true,
          },
        }),
      },
    },
    android: {
      ...config.android,
      package: getVariantIdentifier(baseAndroidPackage, variant),
      googleServicesFile: googleServicesJsonPath,
    },
  } as ExpoConfig
}
