#!/usr/bin/env npx tsx
/**
 * Creates or reuses Firebase resources for the Expo app, downloads native configs,
 * and uploads production-only Sensitive file variables to EAS.
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
const ANDROID_CONFIG_PATH = path.join(ROOT, 'google-services.json')
const IOS_CONFIG_PATH = path.join(ROOT, 'GoogleService-Info.plist')
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
    GOOGLE_SERVICES_JSON: ANDROID_CONFIG_PATH,
    GOOGLE_SERVICE_INFO_PLIST: IOS_CONFIG_PATH,
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
  console.log(`  Firebase project:   ${projectId}`)
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

  mutationsMayExist = true
  const api = new FirebaseProvisioningApi(request, {
    onRateLimitRetry: ({ attempt, delayMs, maxRetries }) => {
      console.log(
        `  Google API rate limit reached; retrying in ${delayMs / 1_000}s (${attempt}/${maxRetries})...`
      )
    },
  })

  console.log('\nConfiguring the Google Cloud project...')
  const cloud = await api.ensureCloudProject({
    displayName: identity.displayName,
    projectId,
  })
  console.log(`  Project: ${projectId} (${cloud.created ? 'created' : 'reused'})`)

  console.log('\nConfiguring Firebase...')
  const firebase = await api.ensureFirebaseProject(projectId)
  console.log(`  Firebase: ${firebase.created ? 'added' : 'reused'}`)

  const android = await api.ensureAndroidApp({
    displayName: identity.displayName,
    packageName: identity.androidPackage,
    projectId,
  })
  console.log(`  Android app: ${android.created ? 'created' : 'reused'}`)

  const ios = await api.ensureIosApp({
    bundleId: identity.iosBundleIdentifier,
    displayName: identity.displayName,
    projectId,
  })
  console.log(`  iOS app: ${ios.created ? 'created' : 'reused'}`)

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

  console.log('\nDownloading native Firebase configuration...')
  const androidName = android.app.name!
  const androidAppId = android.app.appId!
  const iosName = ios.app.name!
  const iosAppId = ios.app.appId!
  const androidConfig = await api.downloadAndroidConfig(androidName)
  const iosConfig = await api.downloadIosConfig(iosName)
  validateAndroidConfig(androidConfig, {
    appId: androidAppId,
    packageName: identity.androidPackage,
    projectId,
  })
  validateIosConfig(iosConfig, {
    appId: iosAppId,
    bundleId: identity.iosBundleIdentifier,
    projectId,
  })

  try {
    replaceFirebaseConfigFiles(
      {
        androidContents: androidConfig,
        androidPath: ANDROID_CONFIG_PATH,
        iosContents: iosConfig,
        iosPath: IOS_CONFIG_PATH,
      },
      () => {
        console.log('  Validating local and production Expo configuration...')
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
  setEasFileVariable('GOOGLE_SERVICES_JSON', ANDROID_CONFIG_PATH)
  console.log('  GOOGLE_SERVICES_JSON: production / Sensitive / File')
  setEasFileVariable('GOOGLE_SERVICE_INFO_PLIST', IOS_CONFIG_PATH)
  console.log('  GOOGLE_SERVICE_INFO_PLIST: production / Sensitive / File')

  console.log(`\n✅ Firebase configured: ${projectId}`)
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
