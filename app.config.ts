import { ConfigContext, ExpoConfig } from 'expo/config'
import { existsSync } from 'fs'

// Firebase config files are provided via EAS file environment variables
// (visibility: secret) for every environment — development / preview / production.
// EAS materialises the uploaded file on disk and sets process.env.<NAME> to its path.
// Locally (expo run:ios / expo run:android), we fall back to the gitignored copies
// downloaded from the Firebase console and placed in the project root.
const googleServicesJsonPath = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'
const googleServiceInfoPlistPath =
  process.env.GOOGLE_SERVICE_INFO_PLIST ?? './GoogleService-Info.plist'

if (!process.env.GOOGLE_SERVICES_JSON && !existsSync(googleServicesJsonPath)) {
  console.warn(
    '\n⚠️  google-services.json not found locally and no EAS file env var resolved.\n' +
      '   Either download it from the Firebase console into the project root,\n' +
      '   or run `eas env:pull --environment <env>` to fetch it from EAS.\n'
  )
}
if (!process.env.GOOGLE_SERVICE_INFO_PLIST && !existsSync(googleServiceInfoPlistPath)) {
  console.warn(
    '\n⚠️  GoogleService-Info.plist not found locally and no EAS file env var resolved.\n' +
      '   Either download it from the Firebase console into the project root,\n' +
      '   or run `eas env:pull --environment <env>` to fetch it from EAS.\n'
  )
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? 'development'
  const isProd = variant === 'production'
  const nameSuffix = isProd ? '' : variant === 'development' ? ' (Dev)' : ' (Preview)'

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
