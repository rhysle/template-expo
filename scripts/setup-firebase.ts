#!/usr/bin/env npx tsx
/**
 * Creates or reuses product-specific production Firebase resources, registers the
 * same native apps in the shared development Firebase project, downloads all four
 * native configs, and uploads production-only Sensitive file variables to EAS.
 *
 * Prerequisite: run npm run setup:expo, authenticate personal Google ADC, and
 * configure the Analytics account documented in README.md.
 *
 * Usage:
 *   npm run setup:firebase
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'

import { GoogleAuth } from 'google-auth-library'

import type { GoogleApiRequester, JsonObject } from './setup-firebase-core'
import {
  assertGoogleApplicationCredentialsUnset,
  assertProductionSensitiveFileVariable,
  buildEasSetArgs,
  buildFirebaseProjectSettingsUrl,
  deriveFirebaseProjectId,
  FirebaseProvisioningApi,
  getFirebaseAppIdentity,
  GoogleApiError,
  parseEasVariableMetadata,
  replaceFirebaseConfigFiles,
  validateAnalyticsAccountId,
  validateAndroidConfig,
  validateIosConfig,
} from './setup-firebase-core'

const ROOT = path.resolve(__dirname, '..')
const APP_JSON_PATH = path.join(ROOT, 'app.json')
const DEVELOPMENT_FIREBASE_PROJECT_ID = 'rhysle-template-expo'
const DEVELOPMENT_ANDROID_CONFIG_PATH = path.join(ROOT, 'google-services.dev.json')
const DEVELOPMENT_IOS_CONFIG_PATH = path.join(ROOT, 'GoogleService-Info.dev.plist')
const PRODUCTION_ANDROID_CONFIG_PATH = path.join(ROOT, 'google-services.json')
const PRODUCTION_IOS_CONFIG_PATH = path.join(ROOT, 'GoogleService-Info.plist')
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'
let mutationsMayExist = false

const isJsonObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const readJson = (target: string): JsonObject =>
  JSON.parse(fs.readFileSync(target, 'utf8')) as JsonObject

const requireEnvironment = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const getGoogleError = (error: unknown): GoogleApiError => {
  if (!isJsonObject(error)) return new GoogleApiError(0, 'Google API request failed.')

  const response = isJsonObject(error.response) ? error.response : undefined
  const status = typeof response?.status === 'number' ? response.status : 0
  const data = isJsonObject(response?.data) ? response.data : undefined
  const apiError = isJsonObject(data?.error) ? data.error : undefined
  const message =
    (typeof apiError?.message === 'string' && apiError.message.trim()) ||
    (typeof error.message === 'string' && error.message.trim()) ||
    'Google API request failed.'
  const code = typeof apiError?.status === 'string' ? apiError.status : undefined
  return new GoogleApiError(status, message, code)
}

const createGoogleRequester = async (): Promise<GoogleApiRequester> => {
  const auth = new GoogleAuth({ scopes: GOOGLE_SCOPE })
  let client
  try {
    client = await auth.getClient()
    if (typeof client.credentials.refresh_token !== 'string') {
      throw new Error('The resolved credentials are not personal user ADC.')
    }
    const accessToken = await client.getAccessToken()
    if (!accessToken.token) throw new Error('Personal user ADC did not return an access token.')
  } catch {
    throw new Error(
      'Personal Google Application Default Credentials are unavailable. Run `gcloud auth application-default login`, set an ADC quota project, and try again.'
    )
  }

  return async <T>({ body, method = 'GET', url }: Parameters<GoogleApiRequester>[0]) => {
    try {
      const response = await client.request<T>({
        data: body,
        method,
        url,
      })
      return response.data
    } catch (error) {
      throw getGoogleError(error)
    }
  }
}

const runEas = (args: string[], captureOutput = false): string =>
  execFileSync('npx', ['eas-cli@latest', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: captureOutput ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })

const setEasFileVariable = (name: string, filePath: string): void => {
  const setVariable = () => {
    const output = runEas(buildEasSetArgs(name, filePath), true)
    return parseEasVariableMetadata(output, name)
  }

  let metadata = setVariable()
  const hasExtraEnvironments =
    metadata.environments.length !== 1 || metadata.environments[0] !== 'production'

  if (hasExtraEnvironments) {
    console.log(`  Reconciling legacy environment scopes for ${name}...`)
    runEas([
      'env:delete',
      'production',
      '--variable-name',
      name,
      '--variable-environment',
      'production',
      '--scope',
      'project',
      '--non-interactive',
    ])
    metadata = setVariable()
  }

  assertProductionSensitiveFileVariable(metadata)
}

const validateExpoConfig = (environment: NodeJS.ProcessEnv): void => {
  execFileSync('npx', ['expo', 'config', '--type', 'public'], {
    cwd: ROOT,
    env: environment,
    stdio: 'inherit',
  })
}

const validateResolvedExpoConfigs = (): void => {
  const {
    APP_VARIANT: _appVariant,
    GOOGLE_SERVICES_JSON: _googleServicesJson,
    GOOGLE_SERVICE_INFO_PLIST: _googleServiceInfoPlist,
    ...baseEnvironment
  } = process.env

  validateExpoConfig({ ...baseEnvironment, APP_VARIANT: 'development' })
  validateExpoConfig({
    ...baseEnvironment,
    APP_VARIANT: 'production',
    GOOGLE_SERVICES_JSON: PRODUCTION_ANDROID_CONFIG_PATH,
    GOOGLE_SERVICE_INFO_PLIST: PRODUCTION_IOS_CONFIG_PATH,
  })
}

const confirm = async (prompt: string): Promise<boolean> => {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await readline.question(`${prompt} (y/N): `)).trim().toLowerCase()
    return answer === 'y' || answer === 'yes'
  } finally {
    readline.close()
  }
}

const describeError = (error: unknown): string => {
  if (error instanceof GoogleApiError) {
    if (error.status === 401) {
      return 'Google rejected the personal ADC credentials. Run `gcloud auth application-default login` and try again.'
    }
    if (error.status === 403) {
      return (
        'Your Google account lacks a required Google Cloud, Firebase, Service Usage, or Analytics ' +
        'permission. Verify the ADC quota project and Analytics Editor access. ' +
        `Google says: ${error.message}`
      )
    }
    if (error.status === 429) {
      return `Google project or API quota remained exceeded after automatic retries. Google says: ${error.message}`
    }
    return `Google API request failed${error.status ? ` (${error.status})` : ''}: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}

const main = async (): Promise<void> => {
  const identity = getFirebaseAppIdentity(readJson(APP_JSON_PATH))
  assertGoogleApplicationCredentialsUnset(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  const analyticsAccountId = validateAnalyticsAccountId(
    requireEnvironment('FIREBASE_ANALYTICS_ACCOUNT_ID')
  )
  const projectId = deriveFirebaseProjectId(
    identity.projectSlug,
    identity.easProjectId,
    process.env.FIREBASE_PROJECT_ID
  )
  console.log('\nChecking Google and Expo authentication...')
  const request = await createGoogleRequester()
  runEas(['whoami'])
  runEas(['project:info'])

  console.log('\nFirebase setup summary:')
  console.log(`  App:                ${identity.displayName}`)
  console.log(`  Production project: ${projectId}`)
  console.log(`  Development project: ${DEVELOPMENT_FIREBASE_PROJECT_ID}`)
  console.log('  Google destination: No organization')
  console.log('  Google auth:        personal Application Default Credentials')
  console.log(`  Analytics account:  ${analyticsAccountId}`)
  console.log(`  iOS bundle ID:      ${identity.iosBundleIdentifier}`)
  console.log(`  Android package:    ${identity.androidPackage}`)
  console.log(`  EAS project ID:     ${identity.easProjectId}`)
  console.log('  Gemini in Firebase: disabled')
  console.log('  Firebase Prod tag:  manual console step')
  console.log('  EAS file variables: production / Sensitive')

  if (!(await confirm('Create or reconcile these Firebase resources?'))) {
    console.log('\nSetup cancelled. No resources or files were changed.')
    return
  }

  const api = new FirebaseProvisioningApi(request, {
    onRateLimitRetry: ({ attempt, delayMs, maxRetries }) => {
      console.log(
        `  Google API rate limit reached; retrying in ${delayMs / 1_000}s (${attempt}/${maxRetries})...`
      )
    },
  })

  console.log('\nVerifying shared development Firebase access...')
  await api.requireFirebaseProject(DEVELOPMENT_FIREBASE_PROJECT_ID)
  console.log(`  Project: ${DEVELOPMENT_FIREBASE_PROJECT_ID} (verified)`)

  mutationsMayExist = true
  console.log('\nConfiguring the Google Cloud project...')
  const cloud = await api.ensureCloudProject({
    displayName: identity.displayName,
    projectId,
  })
  console.log(`  Project: ${projectId} (${cloud.created ? 'created' : 'reused'})`)

  console.log('\nConfiguring Firebase...')
  const firebase = await api.ensureFirebaseProject(projectId)
  console.log(`  Firebase: ${firebase.created ? 'added' : 'reused'}`)

  const productionAndroid = await api.ensureAndroidApp({
    displayName: identity.displayName,
    packageName: identity.androidPackage,
    projectId,
  })
  console.log(`  Android app: ${productionAndroid.created ? 'created' : 'reused'}`)

  const productionIos = await api.ensureIosApp({
    bundleId: identity.iosBundleIdentifier,
    displayName: identity.displayName,
    projectId,
  })
  console.log(`  iOS app: ${productionIos.created ? 'created' : 'reused'}`)

  const analytics = await api.ensureAnalytics(projectId, analyticsAccountId)
  const linkedAccount = analytics.details.analyticsProperty?.analyticsAccountId
  console.log(
    `  Analytics property: ${analytics.created ? 'created and linked' : 'reused'}${analytics.details.analyticsProperty?.id ? ` (${analytics.details.analyticsProperty.id})` : ''}`
  )
  if (linkedAccount && linkedAccount !== analyticsAccountId) {
    console.warn(
      `  ⚠️  Existing Analytics property belongs to account ${linkedAccount}; it was left unchanged.`
    )
  }

  const projectNumber = firebase.project.projectNumber
  if (!projectNumber) throw new Error('Firebase did not return the Google Cloud project number.')
  const gemini = await api.ensureGeminiDisabled(projectNumber)
  console.log(`  Gemini in Firebase: ${gemini.changed ? 'disabled' : 'already disabled'}`)

  console.log('\nConfiguring shared development Firebase apps...')
  const developmentAndroid = await api.ensureAndroidApp({
    displayName: identity.displayName,
    packageName: identity.androidPackage,
    projectId: DEVELOPMENT_FIREBASE_PROJECT_ID,
  })
  console.log(`  Android app: ${developmentAndroid.created ? 'created' : 'reused'}`)

  const developmentIos = await api.ensureIosApp({
    bundleId: identity.iosBundleIdentifier,
    displayName: identity.displayName,
    projectId: DEVELOPMENT_FIREBASE_PROJECT_ID,
  })
  console.log(`  iOS app: ${developmentIos.created ? 'created' : 'reused'}`)

  console.log('\nDownloading native Firebase configuration...')
  const productionAndroidConfig = await api.downloadAndroidConfig(productionAndroid.app.name!)
  const productionIosConfig = await api.downloadIosConfig(productionIos.app.name!)
  const developmentAndroidConfig = await api.downloadAndroidConfig(developmentAndroid.app.name!)
  const developmentIosConfig = await api.downloadIosConfig(developmentIos.app.name!)

  validateAndroidConfig(productionAndroidConfig, {
    appId: productionAndroid.app.appId!,
    packageName: identity.androidPackage,
    projectId,
  })
  validateIosConfig(productionIosConfig, {
    appId: productionIos.app.appId!,
    bundleId: identity.iosBundleIdentifier,
    projectId,
  })
  validateAndroidConfig(developmentAndroidConfig, {
    appId: developmentAndroid.app.appId!,
    packageName: identity.androidPackage,
    projectId: DEVELOPMENT_FIREBASE_PROJECT_ID,
  })
  validateIosConfig(developmentIosConfig, {
    appId: developmentIos.app.appId!,
    bundleId: identity.iosBundleIdentifier,
    projectId: DEVELOPMENT_FIREBASE_PROJECT_ID,
  })

  try {
    replaceFirebaseConfigFiles(
      {
        files: [
          {
            contents: productionAndroidConfig,
            path: PRODUCTION_ANDROID_CONFIG_PATH,
          },
          {
            contents: productionIosConfig,
            path: PRODUCTION_IOS_CONFIG_PATH,
          },
          {
            contents: developmentAndroidConfig,
            path: DEVELOPMENT_ANDROID_CONFIG_PATH,
          },
          {
            contents: developmentIosConfig,
            path: DEVELOPMENT_IOS_CONFIG_PATH,
          },
        ],
      },
      () => {
        console.log('  Validating development and production Expo configuration...')
        validateResolvedExpoConfigs()
      }
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Local Firebase files were restored after validation failed.\nReason: ${reason}`
    )
  }

  console.log('\nUploading Firebase files to EAS...')
  setEasFileVariable('GOOGLE_SERVICES_JSON', PRODUCTION_ANDROID_CONFIG_PATH)
  console.log('  GOOGLE_SERVICES_JSON: production / Sensitive / File')
  setEasFileVariable('GOOGLE_SERVICE_INFO_PLIST', PRODUCTION_IOS_CONFIG_PATH)
  console.log('  GOOGLE_SERVICE_INFO_PLIST: production / Sensitive / File')

  console.log(`\n✅ Production Firebase configured: ${projectId}`)
  console.log(`✅ Development Firebase configured: ${DEVELOPMENT_FIREBASE_PROJECT_ID}`)
  console.log(
    `Verify the Firebase Production environment tag manually: ${buildFirebaseProjectSettingsUrl(projectId)}`
  )
  console.log('Run npm run prebuild:clean before the next native build.')
}

void main().catch((error: unknown) => {
  console.error(`\n❌ ${describeError(error)}`)
  if (mutationsMayExist) {
    console.error(
      'Cloud and EAS changes are not deleted automatically; rerun setup to reconcile them.'
    )
  }
  process.exitCode = 1
})
