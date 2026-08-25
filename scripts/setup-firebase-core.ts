import fs from 'node:fs'

import plist from '@expo/plist'

export type JsonObject = Record<string, unknown>

export type FirebaseAppIdentity = {
  androidPackage: string
  displayName: string
  easProjectId: string
  iosBundleIdentifier: string
  projectSlug: string
}

export type GoogleApiRequest = {
  body?: unknown
  method?: 'GET' | 'POST'
  url: string
}

export type GoogleApiRequester = <T>(request: GoogleApiRequest) => Promise<T>

export type CloudProject = {
  displayName?: string
  name?: string
  parent?: string
  projectId?: string
  state?: string
}

export type FirebaseProject = {
  displayName?: string
  name?: string
  projectId?: string
  projectNumber?: string
  state?: string
}

export type AndroidApp = {
  appId?: string
  displayName?: string
  name?: string
  packageName?: string
  state?: string
}

export type IosApp = {
  appId?: string
  bundleId?: string
  displayName?: string
  name?: string
  state?: string
}

export type AnalyticsDetails = {
  analyticsProperty?: {
    analyticsAccountId?: string
    displayName?: string
    id?: string
  }
  streamMappings?: Array<{
    app?: string
    measurementId?: string
    streamId?: string
  }>
}

export type EasVariableMetadata = {
  environments: string[]
  name: string
  type: string
  visibility: string
}

type GoogleOperation = {
  done?: boolean
  error?: {
    code?: number
    message?: string
  }
  name?: string
  response?: unknown
}

type AppConfigResponse = {
  configFileContents?: string
  configFilename?: string
}

type ListAndroidAppsResponse = {
  apps?: AndroidApp[]
  nextPageToken?: string
}

type ListIosAppsResponse = {
  apps?: IosApp[]
  nextPageToken?: string
}

type SearchProjectsResponse = {
  nextPageToken?: string
  projects?: CloudProject[]
}

type ServiceUsageState = {
  state?: string
}

type PollingOptions = {
  maxAttempts?: number
  pollIntervalMs?: number
  maxRateLimitRetries?: number
  onRateLimitRetry?: (input: { attempt: number; delayMs: number; maxRetries: number }) => void
  rateLimitInitialDelayMs?: number
  rateLimitMaxDelayMs?: number
  sleep?: (milliseconds: number) => Promise<void>
}

const CLOUD_RESOURCE_MANAGER_BASE = 'https://cloudresourcemanager.googleapis.com/v3'
const FIREBASE_BASE = 'https://firebase.googleapis.com/v1beta1'
const SERVICE_USAGE_BASE = 'https://serviceusage.googleapis.com/v1'
const GEMINI_SERVICE = 'cloudaicompanion.googleapis.com'

const isJsonObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const requireNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`)
  }

  return value.trim()
}

const requireJsonObject = (value: unknown, field: string): JsonObject => {
  if (!isJsonObject(value)) throw new Error(`${field} must be an object.`)
  return value
}

export class GoogleApiError extends Error {
  readonly code?: string
  readonly status: number

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'GoogleApiError'
    this.status = status
    this.code = code
  }
}

export const getFirebaseAppIdentity = (appJson: JsonObject): FirebaseAppIdentity => {
  const expo = requireJsonObject(appJson.expo, 'app.json expo')
  const ios = requireJsonObject(expo.ios, 'expo.ios')
  const android = requireJsonObject(expo.android, 'expo.android')
  const extra = requireJsonObject(expo.extra, 'expo.extra')
  const eas = requireJsonObject(extra.eas, 'expo.extra.eas')
  if (typeof eas.projectId !== 'string' || !eas.projectId.trim()) {
    throw new Error('Run npm run setup:expo first; expo.extra.eas.projectId is missing.')
  }

  const identity = {
    displayName: requireNonEmptyString(expo.name, 'expo.name'),
    projectSlug: requireNonEmptyString(expo.slug, 'expo.slug'),
    iosBundleIdentifier: requireNonEmptyString(ios.bundleIdentifier, 'expo.ios.bundleIdentifier'),
    androidPackage: requireNonEmptyString(android.package, 'expo.android.package'),
    easProjectId: eas.projectId.trim(),
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identity.easProjectId
    )
  ) {
    throw new Error('Run npm run setup:expo first; expo.extra.eas.projectId is not a valid UUID.')
  }

  return identity
}

export const assertGoogleApplicationCredentialsUnset = (value?: string): void => {
  if (value?.trim()) {
    throw new Error(
      'Unset GOOGLE_APPLICATION_CREDENTIALS before running setup:firebase. This workflow uses personal Google Application Default Credentials from `gcloud auth application-default login`.'
    )
  }
}

export const validateAnalyticsAccountId = (value: string): string => {
  const normalized = value.trim()
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error('FIREBASE_ANALYTICS_ACCOUNT_ID must be a numeric Google Analytics account ID.')
  }

  return normalized
}

export const validateFirebaseProjectId = (value: string): string => {
  const normalized = value.trim()
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(normalized)) {
    throw new Error(
      'Firebase project ID must be 6-30 lowercase letters, numbers, or hyphens, start with a letter, and end with a letter or number.'
    )
  }
  if (normalized.includes('google') || normalized.includes('ssl')) {
    throw new Error('Firebase project ID cannot contain the restricted strings "google" or "ssl".')
  }
  if (normalized === 'null' || normalized === 'undefined') {
    throw new Error(`Firebase project ID cannot be "${normalized}".`)
  }

  return normalized
}

export const deriveFirebaseProjectId = (
  projectSlug: string,
  easProjectId: string,
  override?: string
): string => {
  if (override?.trim()) return validateFirebaseProjectId(override)

  const suffix = easProjectId.replaceAll('-', '').toLowerCase().slice(0, 8)
  if (!/^[0-9a-f]{8}$/.test(suffix)) {
    throw new Error('Cannot derive Firebase project ID from an invalid EAS project UUID.')
  }

  let base = projectSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replaceAll('google', 'app')
    .replaceAll('ssl', 'app')

  if (!/^[a-z]/.test(base)) base = `app-${base}`
  base = base.slice(0, 21).replace(/-+$/g, '')
  if (!base) base = 'app'

  return validateFirebaseProjectId(`${base}-${suffix}`)
}

export const buildFirebaseProjectSettingsUrl = (projectId: string): string =>
  `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/settings/general`

export const decodeFirebaseConfig = (response: AppConfigResponse, field: string): string => {
  const encoded = requireNonEmptyString(response.configFileContents, `${field}.configFileContents`)
  const contents = Buffer.from(encoded, 'base64').toString('utf8')
  if (!contents.trim()) throw new Error(`${field} decoded to an empty file.`)
  return contents
}

export const validateAndroidConfig = (
  contents: string,
  expected: { appId: string; packageName: string; projectId: string }
): void => {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new Error('Firebase returned invalid google-services.json content.')
  }

  const root = requireJsonObject(parsed, 'google-services.json')
  const projectInfo = requireJsonObject(root.project_info, 'google-services.json project_info')
  if (projectInfo.project_id !== expected.projectId) {
    throw new Error(`google-services.json project ID does not match ${expected.projectId}.`)
  }

  const clients = Array.isArray(root.client) ? root.client : []
  const hasExpectedClient = clients.some((client) => {
    if (!isJsonObject(client) || !isJsonObject(client.client_info)) return false
    const androidInfo = client.client_info.android_client_info
    return (
      client.client_info.mobilesdk_app_id === expected.appId &&
      isJsonObject(androidInfo) &&
      androidInfo.package_name === expected.packageName
    )
  })

  if (!hasExpectedClient) {
    throw new Error(
      `google-services.json does not contain app ${expected.appId} for ${expected.packageName}.`
    )
  }
}

export const validateIosConfig = (
  contents: string,
  expected: { appId: string; bundleId: string; projectId: string }
): void => {
  let parsed: ReturnType<typeof plist.parse>
  try {
    parsed = plist.parse(contents)
  } catch {
    throw new Error('Firebase returned invalid GoogleService-Info.plist content.')
  }

  if (
    parsed.PROJECT_ID !== expected.projectId ||
    parsed.GOOGLE_APP_ID !== expected.appId ||
    parsed.BUNDLE_ID !== expected.bundleId
  ) {
    throw new Error(
      `GoogleService-Info.plist does not match project ${expected.projectId}, app ${expected.appId}, and bundle ${expected.bundleId}.`
    )
  }
}

type FileSnapshot = {
  contents?: Buffer
  existed: boolean
}

const snapshotFile = (target: string): FileSnapshot => ({
  contents: fs.existsSync(target) ? fs.readFileSync(target) : undefined,
  existed: fs.existsSync(target),
})

const writeFileAtomically = (target: string, contents: string | Buffer): void => {
  const temporary = `${target}.setup-firebase.tmp`
  fs.writeFileSync(temporary, contents)
  fs.renameSync(temporary, target)
}

const restoreFile = (target: string, snapshot: FileSnapshot): void => {
  if (snapshot.existed && snapshot.contents) {
    writeFileAtomically(target, snapshot.contents)
    return
  }
  if (fs.existsSync(target)) fs.unlinkSync(target)
}

export const replaceFirebaseConfigFiles = (
  input: {
    files: ReadonlyArray<{
      contents: string | Buffer
      path: string
    }>
  },
  validate: () => void
): void => {
  const snapshots = input.files.map(({ path: target }) => ({
    snapshot: snapshotFile(target),
    target,
  }))

  try {
    for (const file of input.files) {
      writeFileAtomically(file.path, file.contents)
    }
    validate()
  } catch (error) {
    for (const { snapshot, target } of snapshots.reverse()) {
      restoreFile(target, snapshot)
    }
    throw error
  }
}

const normalizeEnvironment = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.toLowerCase()
  if (isJsonObject(value) && typeof value.name === 'string') return value.name.toLowerCase()
  return undefined
}

const normalizeEasVariableType = (value: unknown, field: string): string => {
  const type = requireNonEmptyString(value, field).toLowerCase()
  return type === 'file_base64' || type === 'filebase64' ? 'file' : type
}

const findEasVariable = (value: unknown, expectedName: string): JsonObject | undefined => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findEasVariable(item, expectedName)
      if (result) return result
    }
    return undefined
  }

  if (!isJsonObject(value)) return undefined
  if (value.name === expectedName) return value

  for (const child of Object.values(value)) {
    const result = findEasVariable(child, expectedName)
    if (result) return result
  }
  return undefined
}

export const parseEasVariableMetadata = (
  output: string,
  expectedName: string
): EasVariableMetadata => {
  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch {
    throw new Error(`EAS CLI did not return valid JSON for ${expectedName}.`)
  }

  const variable = findEasVariable(parsed, expectedName)
  if (!variable) throw new Error(`EAS CLI response did not contain ${expectedName}.`)

  const rawEnvironments = Array.isArray(variable.environments) ? variable.environments : []
  const environments = rawEnvironments
    .map(normalizeEnvironment)
    .filter((environment): environment is string => Boolean(environment))
    .sort()

  return {
    environments,
    name: expectedName,
    type: normalizeEasVariableType(variable.type, `${expectedName}.type`),
    visibility: requireNonEmptyString(
      variable.visibility,
      `${expectedName}.visibility`
    ).toLowerCase(),
  }
}

export const buildEasSetArgs = (name: string, filePath: string): string[] => [
  'env:set',
  'production',
  '--name',
  name,
  '--value',
  filePath,
  '--type',
  'file',
  '--visibility',
  'sensitive',
  '--scope',
  'project',
  '--json',
]

export const assertProductionSensitiveFileVariable = (metadata: EasVariableMetadata): void => {
  if (
    metadata.environments.length !== 1 ||
    metadata.environments[0] !== 'production' ||
    metadata.type !== 'file' ||
    metadata.visibility !== 'sensitive'
  ) {
    throw new Error(
      `${metadata.name} must be a project-scoped File variable with Sensitive visibility in production only.`
    )
  }
}

const defaultSleep = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export class FirebaseProvisioningApi {
  private readonly maxAttempts: number
  private readonly maxRateLimitRetries: number
  private readonly onRateLimitRetry?: PollingOptions['onRateLimitRetry']
  private readonly pollIntervalMs: number
  private readonly rateLimitInitialDelayMs: number
  private readonly rateLimitMaxDelayMs: number
  private readonly sleep: (milliseconds: number) => Promise<void>

  constructor(
    private readonly request: GoogleApiRequester,
    options: PollingOptions = {}
  ) {
    this.maxAttempts = options.maxAttempts ?? 300
    this.maxRateLimitRetries = options.maxRateLimitRetries ?? 4
    this.onRateLimitRetry = options.onRateLimitRetry
    this.pollIntervalMs = options.pollIntervalMs ?? 2_000
    this.rateLimitInitialDelayMs = options.rateLimitInitialDelayMs ?? 15_000
    this.rateLimitMaxDelayMs = options.rateLimitMaxDelayMs ?? 60_000
    this.sleep = options.sleep ?? defaultSleep
  }

  private async requestWithRateLimitRetry<T>(request: GoogleApiRequest): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.request<T>(request)
      } catch (error) {
        if (
          !(error instanceof GoogleApiError) ||
          error.status !== 429 ||
          attempt >= this.maxRateLimitRetries
        ) {
          throw error
        }

        const delayMs = Math.min(
          this.rateLimitInitialDelayMs * 2 ** attempt,
          this.rateLimitMaxDelayMs
        )
        this.onRateLimitRetry?.({
          attempt: attempt + 1,
          delayMs,
          maxRetries: this.maxRateLimitRetries,
        })
        await this.sleep(delayMs)
      }
    }
  }

  private async pollOperation(operation: GoogleOperation, baseUrl: string): Promise<unknown> {
    let current = operation
    const name = requireNonEmptyString(operation.name, 'Google operation name')

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      if (current.done) {
        if (current.error) {
          throw new Error(
            `Google operation failed${current.error.code ? ` (${current.error.code})` : ''}: ${current.error.message || 'Unknown error'}`
          )
        }
        return current.response
      }

      await this.sleep(this.pollIntervalMs)
      current = await this.requestWithRateLimitRetry<GoogleOperation>({
        url: `${baseUrl}/${name}`,
      })
    }

    throw new Error(`Timed out waiting for Google operation ${name}.`)
  }

  private async retryUntil<T>(load: () => Promise<T | undefined>, description: string): Promise<T> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const value = await load()
      if (value !== undefined) return value
      await this.sleep(this.pollIntervalMs)
    }

    throw new Error(`Timed out waiting for ${description}.`)
  }

  async getCloudProject(projectId: string): Promise<CloudProject | undefined> {
    let pageToken: string | undefined

    do {
      const query = new URLSearchParams({
        pageSize: '100',
        query: `projectId:${projectId}`,
      })
      if (pageToken) query.set('pageToken', pageToken)
      const response = await this.requestWithRateLimitRetry<SearchProjectsResponse>({
        url: `${CLOUD_RESOURCE_MANAGER_BASE}/projects:search?${query}`,
      })
      const project = response.projects?.find((candidate) => candidate.projectId === projectId)
      if (project) return project
      pageToken = response.nextPageToken || undefined
    } while (pageToken)

    return undefined
  }

  private async retryCloudProjectSearch(
    projectId: string,
    maxAttempts: number
  ): Promise<CloudProject | undefined> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const project = await this.getCloudProject(projectId)
      if (project) return project
      if (attempt < maxAttempts - 1) await this.sleep(this.pollIntervalMs)
    }

    return undefined
  }

  async ensureCloudProject(input: {
    displayName: string
    projectId: string
  }): Promise<{ created: boolean; project: CloudProject }> {
    let project = await this.getCloudProject(input.projectId)
    let created = false

    if (!project) {
      try {
        const operation = await this.requestWithRateLimitRetry<GoogleOperation>({
          body: {
            displayName: input.displayName,
            projectId: input.projectId,
          },
          method: 'POST',
          url: `${CLOUD_RESOURCE_MANAGER_BASE}/projects`,
        })
        await this.pollOperation(operation, CLOUD_RESOURCE_MANAGER_BASE)
        created = true
      } catch (error) {
        if (error instanceof GoogleApiError && error.status === 409) {
          project = await this.retryCloudProjectSearch(
            input.projectId,
            Math.min(this.maxAttempts, 5)
          )
          if (!project) {
            throw new Error(
              `Google Cloud project ID ${input.projectId} is already or was previously used. Set FIREBASE_PROJECT_ID to another globally unique ID.`
            )
          }
        } else {
          throw error
        }
      }
      if (!project) {
        project = await this.retryUntil(
          () => this.getCloudProject(input.projectId),
          `Google Cloud project ${input.projectId}`
        )
      }
    }

    if (project.projectId !== input.projectId) {
      throw new Error(`Google Cloud returned an unexpected project for ${input.projectId}.`)
    }
    if (project.parent?.trim()) {
      throw new Error(
        `Google Cloud project ${input.projectId} belongs to ${project.parent}; expected a standalone project under No organization.`
      )
    }
    if (project.state && project.state !== 'ACTIVE') {
      throw new Error(`Google Cloud project ${input.projectId} is ${project.state}, not ACTIVE.`)
    }

    return { created, project }
  }

  async getFirebaseProject(projectId: string): Promise<FirebaseProject | undefined> {
    try {
      return await this.requestWithRateLimitRetry<FirebaseProject>({
        url: `${FIREBASE_BASE}/projects/${encodeURIComponent(projectId)}`,
      })
    } catch (error) {
      if (error instanceof GoogleApiError && error.status === 404) return undefined
      throw error
    }
  }

  async ensureFirebaseProject(projectId: string): Promise<{
    created: boolean
    project: FirebaseProject
  }> {
    let project = await this.getFirebaseProject(projectId)
    let created = false

    if (!project) {
      try {
        const operation = await this.requestWithRateLimitRetry<GoogleOperation>({
          body: {},
          method: 'POST',
          url: `${FIREBASE_BASE}/projects/${encodeURIComponent(projectId)}:addFirebase`,
        })
        await this.pollOperation(operation, FIREBASE_BASE)
        created = true
      } catch (error) {
        if (!(error instanceof GoogleApiError) || error.status !== 409) throw error
      }

      project = await this.retryUntil(
        () => this.getFirebaseProject(projectId),
        `Firebase project ${projectId}`
      )
    }

    if (project.state && project.state !== 'ACTIVE') {
      throw new Error(`Firebase project ${projectId} is ${project.state}, not ACTIVE.`)
    }
    return { created, project }
  }

  async requireFirebaseProject(projectId: string): Promise<FirebaseProject> {
    const project = await this.getFirebaseProject(projectId)
    if (!project) {
      throw new Error(
        `Shared development Firebase project ${projectId} does not exist or is not accessible.`
      )
    }
    if (project.state && project.state !== 'ACTIVE') {
      throw new Error(`Firebase project ${projectId} is ${project.state}, not ACTIVE.`)
    }
    return project
  }

  private async listAndroidApps(projectId: string): Promise<AndroidApp[]> {
    const apps: AndroidApp[] = []
    let pageToken: string | undefined

    do {
      const query = new URLSearchParams({ showDeleted: 'true' })
      if (pageToken) query.set('pageToken', pageToken)
      const response = await this.requestWithRateLimitRetry<ListAndroidAppsResponse>({
        url: `${FIREBASE_BASE}/projects/${encodeURIComponent(projectId)}/androidApps?${query}`,
      })
      apps.push(...(response.apps ?? []))
      pageToken = response.nextPageToken || undefined
    } while (pageToken)

    return apps
  }

  private async listIosApps(projectId: string): Promise<IosApp[]> {
    const apps: IosApp[] = []
    let pageToken: string | undefined

    do {
      const query = new URLSearchParams({ showDeleted: 'true' })
      if (pageToken) query.set('pageToken', pageToken)
      const response = await this.requestWithRateLimitRetry<ListIosAppsResponse>({
        url: `${FIREBASE_BASE}/projects/${encodeURIComponent(projectId)}/iosApps?${query}`,
      })
      apps.push(...(response.apps ?? []))
      pageToken = response.nextPageToken || undefined
    } while (pageToken)

    return apps
  }

  private selectApp<T extends { state?: string }>(
    apps: T[],
    identifier: string,
    platform: string
  ): T | undefined {
    const active = apps.filter(({ state }) => !state || state === 'ACTIVE')
    const deleted = apps.filter(({ state }) => state === 'DELETED')
    if (active.length > 1) {
      throw new Error(`Firebase contains multiple active ${platform} apps for ${identifier}.`)
    }
    if (active.length === 0 && deleted.length > 0) {
      throw new Error(
        `Firebase contains a deleted ${platform} app for ${identifier}. Restore or permanently remove it before rerunning setup.`
      )
    }
    return active[0]
  }

  async ensureAndroidApp(input: {
    displayName: string
    packageName: string
    projectId: string
  }): Promise<{ app: AndroidApp; created: boolean }> {
    const find = async (): Promise<AndroidApp | undefined> => {
      const matching = (await this.listAndroidApps(input.projectId)).filter(
        ({ packageName }) => packageName === input.packageName
      )
      return this.selectApp(matching, input.packageName, 'Android')
    }

    let app = await find()
    let created = false
    if (!app) {
      try {
        const operation = await this.requestWithRateLimitRetry<GoogleOperation>({
          body: { displayName: `${input.displayName} Android`, packageName: input.packageName },
          method: 'POST',
          url: `${FIREBASE_BASE}/projects/${encodeURIComponent(input.projectId)}/androidApps`,
        })
        await this.pollOperation(operation, FIREBASE_BASE)
        created = true
      } catch (error) {
        if (!(error instanceof GoogleApiError) || error.status !== 409) throw error
      }
      app = await this.retryUntil(find, `Firebase Android app ${input.packageName}`)
    }

    requireNonEmptyString(app.name, 'Firebase Android app name')
    requireNonEmptyString(app.appId, 'Firebase Android app ID')
    return { app, created }
  }

  async ensureIosApp(input: {
    bundleId: string
    displayName: string
    projectId: string
  }): Promise<{ app: IosApp; created: boolean }> {
    const find = async (): Promise<IosApp | undefined> => {
      const matching = (await this.listIosApps(input.projectId)).filter(
        ({ bundleId }) => bundleId === input.bundleId
      )
      return this.selectApp(matching, input.bundleId, 'iOS')
    }

    let app = await find()
    let created = false
    if (!app) {
      try {
        const operation = await this.requestWithRateLimitRetry<GoogleOperation>({
          body: { bundleId: input.bundleId, displayName: `${input.displayName} iOS` },
          method: 'POST',
          url: `${FIREBASE_BASE}/projects/${encodeURIComponent(input.projectId)}/iosApps`,
        })
        await this.pollOperation(operation, FIREBASE_BASE)
        created = true
      } catch (error) {
        if (!(error instanceof GoogleApiError) || error.status !== 409) throw error
      }
      app = await this.retryUntil(find, `Firebase iOS app ${input.bundleId}`)
    }

    requireNonEmptyString(app.name, 'Firebase iOS app name')
    requireNonEmptyString(app.appId, 'Firebase iOS app ID')
    return { app, created }
  }

  async ensureAnalytics(
    projectId: string,
    analyticsAccountId: string
  ): Promise<{ created: boolean; details: AnalyticsDetails }> {
    const getDetails = async (): Promise<AnalyticsDetails | undefined> => {
      try {
        return await this.requestWithRateLimitRetry<AnalyticsDetails>({
          url: `${FIREBASE_BASE}/projects/${encodeURIComponent(projectId)}/analyticsDetails`,
        })
      } catch (error) {
        if (error instanceof GoogleApiError && error.status === 404) return undefined
        throw error
      }
    }

    let details = await getDetails()
    let created = false
    if (!details) {
      try {
        const operation = await this.requestWithRateLimitRetry<GoogleOperation>({
          body: { analyticsAccountId },
          method: 'POST',
          url: `${FIREBASE_BASE}/projects/${encodeURIComponent(projectId)}:addGoogleAnalytics`,
        })
        await this.pollOperation(operation, FIREBASE_BASE)
        created = true
      } catch (error) {
        if (!(error instanceof GoogleApiError) || error.status !== 409) throw error
      }
      details = await this.retryUntil(getDetails, `Google Analytics link for ${projectId}`)
    }

    return { created, details }
  }

  async downloadAndroidConfig(appName: string): Promise<string> {
    const response = await this.requestWithRateLimitRetry<AppConfigResponse>({
      url: `${FIREBASE_BASE}/${appName}/config`,
    })
    return decodeFirebaseConfig(response, 'Android app config')
  }

  async downloadIosConfig(appName: string): Promise<string> {
    const response = await this.requestWithRateLimitRetry<AppConfigResponse>({
      url: `${FIREBASE_BASE}/${appName}/config`,
    })
    return decodeFirebaseConfig(response, 'iOS app config')
  }

  private async getGeminiServiceState(projectNumber: string): Promise<string> {
    try {
      const service = await this.requestWithRateLimitRetry<ServiceUsageState>({
        url: `${SERVICE_USAGE_BASE}/projects/${encodeURIComponent(projectNumber)}/services/${GEMINI_SERVICE}`,
      })
      return requireNonEmptyString(service.state, 'Gemini service state')
    } catch (error) {
      if (error instanceof GoogleApiError && error.status === 404) return 'DISABLED'
      throw error
    }
  }

  async ensureGeminiDisabled(projectNumber: string): Promise<{ changed: boolean }> {
    const state = await this.getGeminiServiceState(projectNumber)
    if (state === 'DISABLED') return { changed: false }
    if (state !== 'ENABLED') throw new Error(`Unexpected Gemini service state: ${state}.`)

    const operation = await this.requestWithRateLimitRetry<GoogleOperation>({
      body: { checkIfServiceHasUsage: 'SKIP', disableDependentServices: false },
      method: 'POST',
      url: `${SERVICE_USAGE_BASE}/projects/${encodeURIComponent(projectNumber)}/services/${GEMINI_SERVICE}:disable`,
    })
    await this.pollOperation(operation, SERVICE_USAGE_BASE)

    const finalState = await this.retryUntil(async () => {
      const current = await this.getGeminiServiceState(projectNumber)
      return current === 'DISABLED' ? current : undefined
    }, 'Gemini in Firebase to be disabled')
    if (finalState !== 'DISABLED') throw new Error('Gemini in Firebase could not be disabled.')
    return { changed: true }
  }
}
