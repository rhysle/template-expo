const { existsSync } = require('node:fs')

const { getVariantDisplayName, getVariantIdentifier, resolveAppVariant } = require('./app-variant')

const DEVELOPMENT_ANDROID_FIREBASE_CONFIG = './google-services.dev.json'
const DEVELOPMENT_IOS_FIREBASE_CONFIG = './GoogleService-Info.dev.plist'
const PRODUCTION_ANDROID_FIREBASE_CONFIG = './google-services.json'
const PRODUCTION_IOS_FIREBASE_CONFIG = './GoogleService-Info.plist'

const createExpoAppConfig = ({ config }) => {
  const variant = resolveAppVariant()
  const isProd = variant === 'production'
  const baseName = config.name
  const baseIosBundleIdentifier = config.ios.bundleIdentifier
  const baseAndroidPackage = config.android.package
  const baseScheme = config.scheme
  // Production EAS builds receive Firebase config through project-scoped Sensitive file
  // variables. Local development always uses the shared development Firebase project files
  // downloaded by `pnpm setup:firebase`.
  const googleServicesJsonPath = isProd
    ? (process.env.GOOGLE_SERVICES_JSON ?? PRODUCTION_ANDROID_FIREBASE_CONFIG)
    : DEVELOPMENT_ANDROID_FIREBASE_CONFIG
  const googleServiceInfoPlistPath = isProd
    ? (process.env.GOOGLE_SERVICE_INFO_PLIST ?? PRODUCTION_IOS_FIREBASE_CONFIG)
    : DEVELOPMENT_IOS_FIREBASE_CONFIG

  if (!existsSync(googleServicesJsonPath)) {
    console.warn(
      `\n⚠️  Firebase Android config not found at ${googleServicesJsonPath}.\n` +
        '   Run `pnpm setup:firebase` before prebuilding the native app.\n'
    )
  }
  if (!existsSync(googleServiceInfoPlistPath)) {
    console.warn(
      `\n⚠️  Firebase iOS config not found at ${googleServiceInfoPlistPath}.\n` +
        '   Run `pnpm setup:firebase` before prebuilding the native app.\n'
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
  }
}

module.exports = { createExpoAppConfig }
