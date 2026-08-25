import { ConfigContext, ExpoConfig } from 'expo/config'
import { existsSync } from 'fs'

const DEVELOPMENT_ANDROID_FIREBASE_CONFIG = './google-services.dev.json'
const DEVELOPMENT_IOS_FIREBASE_CONFIG = './GoogleService-Info.dev.plist'
const PRODUCTION_ANDROID_FIREBASE_CONFIG = './google-services.json'
const PRODUCTION_IOS_FIREBASE_CONFIG = './GoogleService-Info.plist'

const resolveAppVariant = (): 'development' | 'production' => {
  const variant = process.env.APP_VARIANT

  if (variant === undefined && process.env.NODE_ENV !== 'production') return 'development'
  if (variant === 'development' || variant === 'production') return variant

  throw new Error(
    'APP_VARIANT must be "development" or "production". Configure it in the selected EAS build profile or EAS Update environment.'
  )
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveAppVariant()
  const isProd = variant === 'production'
  const nameSuffix = isProd ? '' : ' (Dev)'
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
    name: `${config.name}${nameSuffix}`,
    ios: {
      ...config.ios,
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
      googleServicesFile: googleServicesJsonPath,
    },
  } as ExpoConfig
}
