import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import plist from '@expo/plist'

import type { GoogleApiRequest, GoogleApiRequester, JsonObject } from './setup-firebase-core'
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
  validateAndroidConfig,
  validateFirebaseProjectId,
  validateIosConfig,
} from './setup-firebase-core'

type PlannedRequest = {
  body?: unknown
  error?: Error
  method?: string
  response?: unknown
  url: string | RegExp
}

const createRequester =
  (plan: PlannedRequest[], seen: GoogleApiRequest[] = []): GoogleApiRequester =>
  async <T>(request: GoogleApiRequest): Promise<T> => {
    seen.push(request)
    const next = plan.shift()
    assert.ok(next, `Unexpected request: ${request.method ?? 'GET'} ${request.url}`)
    assert.equal(request.method ?? 'GET', next.method ?? 'GET')
    if (typeof next.url === 'string') assert.equal(request.url, next.url)
    else assert.match(request.url, next.url)
    if ('body' in next) assert.deepEqual(request.body, next.body)
    if (next.error) throw next.error
    return next.response as T
  }

const createAppJson = (): JsonObject => ({
  expo: {
    android: { package: 'com.example.habittracker' },
    extra: { eas: { projectId: '123e4567-e89b-42d3-a456-426614174000' } },
    ios: { bundleIdentifier: 'com.example.habitTracker' },
    name: 'Habit Tracker',
    slug: 'habit-tracker',
  },
})

void test('reads the Firebase identity only after setup:expo', () => {
  assert.deepEqual(getFirebaseAppIdentity(createAppJson()), {
    androidPackage: 'com.example.habittracker',
    displayName: 'Habit Tracker',
    easProjectId: '123e4567-e89b-42d3-a456-426614174000',
    iosBundleIdentifier: 'com.example.habitTracker',
    projectSlug: 'habit-tracker',
  })

  const missingEas = createAppJson()
  ;((missingEas.expo as JsonObject).extra as JsonObject).eas = {}
  assert.throws(() => getFirebaseAppIdentity(missingEas), /setup:expo first/)
})

void test('derives a stable valid project ID and accepts a validated override', () => {
  assert.equal(
    deriveFirebaseProjectId('Habit Tracker', '123e4567-e89b-42d3-a456-426614174000'),
    'habit-tracker-123e4567'
  )
  assert.equal(
    deriveFirebaseProjectId(
      'this-is-a-very-long-project-slug-that-needs-truncation',
      '123e4567-e89b-42d3-a456-426614174000'
    ).length,
    30
  )
  assert.equal(
    deriveFirebaseProjectId('ignored', '123e4567-e89b-42d3-a456-426614174000', 'my-app-123'),
    'my-app-123'
  )
  assert.throws(() => validateFirebaseProjectId('Google-app'), /6-30 lowercase/)
  assert.throws(() => validateFirebaseProjectId('google-app'), /restricted strings/)
  assert.equal(
    buildFirebaseProjectSettingsUrl('habit-tracker-123e4567'),
    'https://console.firebase.google.com/project/habit-tracker-123e4567/settings/general'
  )
})

void test('requires personal ADC instead of GOOGLE_APPLICATION_CREDENTIALS', () => {
  assert.doesNotThrow(() => assertGoogleApplicationCredentialsUnset(undefined))
  assert.doesNotThrow(() => assertGoogleApplicationCredentialsUnset('  '))
  assert.throws(
    () => assertGoogleApplicationCredentialsUnset('/secure/service-account.json'),
    /Unset GOOGLE_APPLICATION_CREDENTIALS.*personal Google Application Default Credentials/
  )
})

void test('validates downloaded Android and iOS configs against the selected apps', () => {
  const android = JSON.stringify({
    client: [
      {
        client_info: {
          android_client_info: { package_name: 'com.example.habittracker' },
          mobilesdk_app_id: '1:123:android:abc',
        },
      },
    ],
    project_info: { project_id: 'habit-tracker-123e4567' },
  })
  const ios = plist.build({
    BUNDLE_ID: 'com.example.habitTracker',
    GOOGLE_APP_ID: '1:123:ios:def',
    PROJECT_ID: 'habit-tracker-123e4567',
  })

  assert.doesNotThrow(() =>
    validateAndroidConfig(android, {
      appId: '1:123:android:abc',
      packageName: 'com.example.habittracker',
      projectId: 'habit-tracker-123e4567',
    })
  )
  assert.doesNotThrow(() =>
    validateIosConfig(ios, {
      appId: '1:123:ios:def',
      bundleId: 'com.example.habitTracker',
      projectId: 'habit-tracker-123e4567',
    })
  )
  assert.throws(
    () =>
      validateAndroidConfig(android, {
        appId: 'wrong',
        packageName: 'com.example.habittracker',
        projectId: 'habit-tracker-123e4567',
      }),
    /does not contain app/
  )
  assert.throws(
    () =>
      validateIosConfig(ios, {
        appId: '1:123:ios:def',
        bundleId: 'com.example.other',
        projectId: 'habit-tracker-123e4567',
      }),
    /does not match/
  )
})

void test('restores both Firebase files when post-write validation fails', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-firebase-'))
  const androidPath = path.join(directory, 'google-services.json')
  const iosPath = path.join(directory, 'GoogleService-Info.plist')
  fs.writeFileSync(androidPath, 'old android')
  fs.writeFileSync(iosPath, 'old ios')

  assert.throws(
    () =>
      replaceFirebaseConfigFiles(
        {
          androidContents: 'new android',
          androidPath,
          iosContents: 'new ios',
          iosPath,
        },
        () => {
          throw new Error('invalid Expo config')
        }
      ),
    /invalid Expo config/
  )
  assert.equal(fs.readFileSync(androidPath, 'utf8'), 'old android')
  assert.equal(fs.readFileSync(iosPath, 'utf8'), 'old ios')
})

void test('builds and verifies production-only Sensitive EAS file variables', () => {
  assert.deepEqual(buildEasSetArgs('GOOGLE_SERVICES_JSON', '/tmp/google-services.json'), [
    'env:set',
    'production',
    '--name',
    'GOOGLE_SERVICES_JSON',
    '--value',
    '/tmp/google-services.json',
    '--type',
    'file',
    '--visibility',
    'sensitive',
    '--scope',
    'project',
    '--json',
  ])

  const metadata = parseEasVariableMetadata(
    JSON.stringify({
      environmentVariable: {
        environments: ['PRODUCTION'],
        name: 'GOOGLE_SERVICES_JSON',
        type: 'FILE_BASE64',
        visibility: 'SENSITIVE',
      },
    }),
    'GOOGLE_SERVICES_JSON'
  )
  assert.doesNotThrow(() => assertProductionSensitiveFileVariable(metadata))

  assert.throws(
    () =>
      assertProductionSensitiveFileVariable({
        ...metadata,
        environments: ['development', 'production'],
      }),
    /production only/
  )
})

void test('creates a missing standalone cloud project and polls the operation', async () => {
  const projectId = 'habit-tracker-123e4567'
  const plan: PlannedRequest[] = [
    {
      response: {},
      url: `https://cloudresourcemanager.googleapis.com/v3/projects:search?pageSize=100&query=projectId%3A${projectId}`,
    },
    {
      body: { displayName: 'Habit Tracker', projectId },
      method: 'POST',
      response: { name: 'operations/create-1' },
      url: 'https://cloudresourcemanager.googleapis.com/v3/projects',
    },
    {
      response: { done: true, name: 'operations/create-1', response: {} },
      url: 'https://cloudresourcemanager.googleapis.com/v3/operations/create-1',
    },
    {
      response: { projects: [{ projectId, state: 'ACTIVE' }] },
      url: `https://cloudresourcemanager.googleapis.com/v3/projects:search?pageSize=100&query=projectId%3A${projectId}`,
    },
  ]
  const api = new FirebaseProvisioningApi(createRequester(plan), {
    pollIntervalMs: 0,
    sleep: async () => {},
  })

  const result = await api.ensureCloudProject({
    displayName: 'Habit Tracker',
    projectId,
  })
  assert.equal(result.created, true)
  assert.equal(result.project.parent, undefined)
  assert.equal(plan.length, 0)
})

void test('rejects reuse of a cloud project attached to an organization', async () => {
  const projectId = 'habit-tracker-123e4567'
  const api = new FirebaseProvisioningApi(
    createRequester([
      {
        response: {
          projects: [{ parent: 'organizations/999', projectId, state: 'ACTIVE' }],
        },
        url: `https://cloudresourcemanager.googleapis.com/v3/projects:search?pageSize=100&query=projectId%3A${projectId}`,
      },
    ]),
    { pollIntervalMs: 0, sleep: async () => {} }
  )

  await assert.rejects(
    api.ensureCloudProject({
      displayName: 'Habit Tracker',
      projectId,
    }),
    /belongs to organizations\/999.*No organization/
  )
})

void test('reports an unavailable global project ID when creation returns a conflict', async () => {
  const projectId = 'habit-tracker-123e4567'
  const api = new FirebaseProvisioningApi(
    createRequester([
      {
        response: {},
        url: `https://cloudresourcemanager.googleapis.com/v3/projects:search?pageSize=100&query=projectId%3A${projectId}`,
      },
      {
        body: { displayName: 'Habit Tracker', projectId },
        error: new GoogleApiError(409, 'Already exists'),
        method: 'POST',
        url: 'https://cloudresourcemanager.googleapis.com/v3/projects',
      },
      {
        response: {},
        url: `https://cloudresourcemanager.googleapis.com/v3/projects:search?pageSize=100&query=projectId%3A${projectId}`,
      },
    ]),
    { maxAttempts: 1, pollIntervalMs: 0, sleep: async () => {} }
  )

  await assert.rejects(
    api.ensureCloudProject({
      displayName: 'Habit Tracker',
      projectId,
    }),
    /already or was previously used.*FIREBASE_PROJECT_ID/
  )
})

void test('reuses a project that becomes searchable after a create conflict', async () => {
  const projectId = 'habit-tracker-123e4567'
  const plan: PlannedRequest[] = [
    {
      response: {},
      url: `https://cloudresourcemanager.googleapis.com/v3/projects:search?pageSize=100&query=projectId%3A${projectId}`,
    },
    {
      body: { displayName: 'Habit Tracker', projectId },
      error: new GoogleApiError(409, 'Already exists'),
      method: 'POST',
      url: 'https://cloudresourcemanager.googleapis.com/v3/projects',
    },
    {
      response: { projects: [{ projectId, state: 'ACTIVE' }] },
      url: `https://cloudresourcemanager.googleapis.com/v3/projects:search?pageSize=100&query=projectId%3A${projectId}`,
    },
  ]
  const api = new FirebaseProvisioningApi(createRequester(plan), {
    pollIntervalMs: 0,
    sleep: async () => {},
  })

  const result = await api.ensureCloudProject({ displayName: 'Habit Tracker', projectId })
  assert.equal(result.created, false)
  assert.equal(result.project.projectId, projectId)
  assert.equal(plan.length, 0)
})

void test('adds Firebase to a cloud project and waits for an active project', async () => {
  const projectId = 'habit-tracker-123e4567'
  const plan: PlannedRequest[] = [
    {
      error: new GoogleApiError(404, 'Not a Firebase project'),
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}`,
    },
    {
      body: {},
      method: 'POST',
      response: { name: 'operations/firebase-1' },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`,
    },
    {
      response: { done: true, name: 'operations/firebase-1', response: {} },
      url: 'https://firebase.googleapis.com/v1beta1/operations/firebase-1',
    },
    {
      response: { projectId, projectNumber: '123456', state: 'ACTIVE' },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}`,
    },
  ]
  const api = new FirebaseProvisioningApi(createRequester(plan), {
    pollIntervalMs: 0,
    sleep: async () => {},
  })

  const result = await api.ensureFirebaseProject(projectId)
  assert.equal(result.created, true)
  assert.equal(result.project.projectNumber, '123456')
  assert.equal(plan.length, 0)
})

void test('creates missing platform apps and reuses exact active registrations', async () => {
  const projectId = 'habit-tracker-123e4567'
  const plan: PlannedRequest[] = [
    {
      response: { apps: [] },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps?showDeleted=true`,
    },
    {
      body: { displayName: 'Habit Tracker Android', packageName: 'com.example.habittracker' },
      method: 'POST',
      response: { name: 'operations/android-1' },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps`,
    },
    {
      response: { done: true, name: 'operations/android-1', response: {} },
      url: 'https://firebase.googleapis.com/v1beta1/operations/android-1',
    },
    {
      response: {
        apps: [
          {
            appId: '1:123:android:abc',
            name: `projects/${projectId}/androidApps/1:123:android:abc`,
            packageName: 'com.example.habittracker',
            state: 'ACTIVE',
          },
        ],
      },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps?showDeleted=true`,
    },
    {
      response: {
        apps: [
          {
            appId: '1:123:ios:def',
            bundleId: 'com.example.habitTracker',
            name: `projects/${projectId}/iosApps/1:123:ios:def`,
            state: 'ACTIVE',
          },
        ],
      },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/iosApps?showDeleted=true`,
    },
  ]
  const api = new FirebaseProvisioningApi(createRequester(plan), {
    pollIntervalMs: 0,
    sleep: async () => {},
  })

  const android = await api.ensureAndroidApp({
    displayName: 'Habit Tracker',
    packageName: 'com.example.habittracker',
    projectId,
  })
  const ios = await api.ensureIosApp({
    bundleId: 'com.example.habitTracker',
    displayName: 'Habit Tracker',
    projectId,
  })

  assert.equal(android.created, true)
  assert.equal(ios.created, false)
  assert.equal(plan.length, 0)
})

void test('links Analytics only when missing and reuses existing details', async () => {
  const projectId = 'habit-tracker-123e4567'
  const plan: PlannedRequest[] = [
    {
      error: new GoogleApiError(404, 'Not linked'),
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/analyticsDetails`,
    },
    {
      body: { analyticsAccountId: '123456' },
      method: 'POST',
      response: { name: 'operations/analytics-1' },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addGoogleAnalytics`,
    },
    {
      response: { done: true, name: 'operations/analytics-1', response: {} },
      url: 'https://firebase.googleapis.com/v1beta1/operations/analytics-1',
    },
    {
      response: { analyticsProperty: { analyticsAccountId: '123456', id: '999' } },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/analyticsDetails`,
    },
    {
      response: { analyticsProperty: { analyticsAccountId: '123456', id: '999' } },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/analyticsDetails`,
    },
  ]
  const api = new FirebaseProvisioningApi(createRequester(plan), {
    pollIntervalMs: 0,
    sleep: async () => {},
  })

  assert.equal((await api.ensureAnalytics(projectId, '123456')).created, true)
  assert.equal((await api.ensureAnalytics(projectId, '123456')).created, false)
  assert.equal(plan.length, 0)
})

void test('backs off and retries when Firebase provisioning is rate limited', async () => {
  const projectId = 'habit-tracker-123e4567'
  const delays: number[] = []
  const plan: PlannedRequest[] = [
    {
      error: new GoogleApiError(404, 'Not linked'),
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/analyticsDetails`,
    },
    {
      body: { analyticsAccountId: '123456' },
      error: new GoogleApiError(
        429,
        "Quota exceeded for quota metric 'Provision requests' and limit 'Provision requests per minute'.",
        'RESOURCE_EXHAUSTED'
      ),
      method: 'POST',
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addGoogleAnalytics`,
    },
    {
      body: { analyticsAccountId: '123456' },
      error: new GoogleApiError(
        429,
        "Quota exceeded for quota metric 'Provision requests' and limit 'Provision requests per minute'.",
        'RESOURCE_EXHAUSTED'
      ),
      method: 'POST',
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addGoogleAnalytics`,
    },
    {
      body: { analyticsAccountId: '123456' },
      method: 'POST',
      response: { done: true, name: 'operations/analytics-1', response: {} },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addGoogleAnalytics`,
    },
    {
      response: { analyticsProperty: { analyticsAccountId: '123456', id: '999' } },
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/analyticsDetails`,
    },
  ]
  const api = new FirebaseProvisioningApi(createRequester(plan), {
    pollIntervalMs: 0,
    sleep: async (milliseconds) => {
      delays.push(milliseconds)
    },
  })

  assert.equal((await api.ensureAnalytics(projectId, '123456')).created, true)
  assert.deepEqual(delays, [15_000, 30_000])
  assert.equal(plan.length, 0)
})

void test('leaves Gemini disabled or disables and verifies an enabled service', async () => {
  const disabledApi = new FirebaseProvisioningApi(
    createRequester([
      {
        response: { state: 'DISABLED' },
        url: /serviceusage\.googleapis\.com.*cloudaicompanion\.googleapis\.com$/,
      },
    ]),
    { pollIntervalMs: 0, sleep: async () => {} }
  )
  assert.deepEqual(await disabledApi.ensureGeminiDisabled('123'), { changed: false })

  const plan: PlannedRequest[] = [
    {
      response: { state: 'ENABLED' },
      url: /serviceusage\.googleapis\.com.*cloudaicompanion\.googleapis\.com$/,
    },
    {
      body: { checkIfServiceHasUsage: 'SKIP', disableDependentServices: false },
      method: 'POST',
      response: { name: 'operations/service-1' },
      url: /cloudaicompanion\.googleapis\.com:disable$/,
    },
    {
      response: { done: true, name: 'operations/service-1', response: {} },
      url: 'https://serviceusage.googleapis.com/v1/operations/service-1',
    },
    {
      response: { state: 'DISABLED' },
      url: /serviceusage\.googleapis\.com.*cloudaicompanion\.googleapis\.com$/,
    },
  ]
  const enabledApi = new FirebaseProvisioningApi(createRequester(plan), {
    pollIntervalMs: 0,
    sleep: async () => {},
  })
  assert.deepEqual(await enabledApi.ensureGeminiDisabled('123'), { changed: true })
  assert.equal(plan.length, 0)
})
