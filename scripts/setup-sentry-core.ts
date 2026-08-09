export type JsonObject = Record<string, unknown>

export type SentryAppIdentity = {
  displayName: string
  projectSlug: string
}

export type SentryOrganization = {
  id: string
  name: string
  slug: string
}

export type SentryProject = {
  id: string
  name: string
  platform?: string
  slug: string
}

export type SentryTeam = {
  id: string
  name: string
  slug: string
}

type SentryClientKey = {
  dsn?: {
    public?: string
  }
  isActive?: boolean
}

type HttpRequestInit = {
  body?: string
  headers: Record<string, string>
  method: string
}

type HttpResponse = {
  ok: boolean
  status: number
  statusText: string
  text: () => Promise<string>
}

export type FetchLike = (url: URL, init: HttpRequestInit) => Promise<HttpResponse>

const SENTRY_PLUGIN_NAME = '@sentry/react-native/expo'
const DEFAULT_SENTRY_URL = 'https://sentry.io/'

const isJsonObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const requireNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`)
  }

  return value.trim()
}

export const getSentryAppIdentity = (appJson: JsonObject): SentryAppIdentity => {
  if (!isJsonObject(appJson.expo)) {
    throw new Error('app.json must contain an "expo" object.')
  }

  const displayName = requireNonEmptyString(appJson.expo.name, 'expo.name')
  const projectSlug = requireNonEmptyString(appJson.expo.slug, 'expo.slug')
  const extra = appJson.expo.extra

  if (!isJsonObject(extra) || !isJsonObject(extra.eas)) {
    throw new Error('Run npm run setup:expo first; expo.extra.eas.projectId is missing.')
  }

  requireNonEmptyString(extra.eas.projectId, 'expo.extra.eas.projectId')
  return { displayName, projectSlug }
}

export const getConfiguredSentryOrganization = (appJson: JsonObject): string | undefined => {
  if (!isJsonObject(appJson.expo) || !Array.isArray(appJson.expo.plugins)) return undefined

  const sentryPlugins = appJson.expo.plugins.filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin
    return name === SENTRY_PLUGIN_NAME
  })
  if (sentryPlugins.length !== 1 || !Array.isArray(sentryPlugins[0])) return undefined

  const options = sentryPlugins[0][1]
  if (!isJsonObject(options) || typeof options.organization !== 'string') return undefined

  return options.organization.trim() || undefined
}

export const selectOrganizationSlug = (
  organizations: SentryOrganization[],
  requestedSlug?: string
): string => {
  if (requestedSlug) {
    const organization = organizations.find(({ slug }) => slug === requestedSlug)
    if (!organization) {
      throw new Error(
        `SENTRY_ORG is "${requestedSlug}", but the token cannot access that organization.`
      )
    }
    return organization.slug
  }

  if (organizations.length === 0) {
    throw new Error('The Sentry token cannot access any organizations.')
  }

  if (organizations.length > 1) {
    const slugs = organizations
      .map(({ slug }) => slug)
      .sort()
      .join(', ')
    throw new Error(
      `The Sentry token can access multiple organizations (${slugs}). Set SENTRY_ORG to choose one.`
    )
  }

  return organizations[0].slug
}

export const selectTeamSlug = (teams: SentryTeam[], requestedSlug?: string): string => {
  if (requestedSlug) {
    const team = teams.find(({ slug }) => slug === requestedSlug)
    if (!team) {
      throw new Error(`SENTRY_TEAM is "${requestedSlug}", but the token cannot access that team.`)
    }
    return team.slug
  }

  if (teams.length === 0) {
    throw new Error(
      'The Sentry organization does not have any teams. Create a team in Sentry, then try again.'
    )
  }

  if (teams.length > 1) {
    const slugs = teams
      .map(({ slug }) => slug)
      .sort()
      .join(', ')
    throw new Error(
      `The Sentry organization has multiple teams (${slugs}). Set SENTRY_TEAM to choose one.`
    )
  }

  return teams[0].slug
}

export const normalizeSentryUrl = (value = DEFAULT_SENTRY_URL): string => {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('SENTRY_URL must use http or https.')
  }

  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.toString()
}

export const validatePublicDsn = (dsn: string): string => {
  const url = new URL(dsn)
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.username) {
    throw new Error('Sentry returned an invalid public DSN.')
  }

  return dsn
}

export const updateSentryPlugin = (
  appJson: JsonObject,
  config: { organization: string; project: string; url: string }
): void => {
  if (!isJsonObject(appJson.expo) || !Array.isArray(appJson.expo.plugins)) {
    throw new Error('app.json must contain an "expo.plugins" array.')
  }

  const matchingIndexes = appJson.expo.plugins.flatMap((plugin, index) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin
    return name === SENTRY_PLUGIN_NAME ? [index] : []
  })

  if (matchingIndexes.length !== 1) {
    throw new Error(
      `app.json must contain exactly one ${SENTRY_PLUGIN_NAME} plugin entry; found ${matchingIndexes.length}.`
    )
  }

  const index = matchingIndexes[0]
  const existing = appJson.expo.plugins[index]
  let existingOptions: JsonObject = {}

  if (Array.isArray(existing)) {
    if (existing.length > 1 && !isJsonObject(existing[1])) {
      throw new Error(`${SENTRY_PLUGIN_NAME} plugin options must be an object.`)
    }
    if (isJsonObject(existing[1])) existingOptions = existing[1]
  }

  appJson.expo.plugins[index] = [
    SENTRY_PLUGIN_NAME,
    {
      ...existingOptions,
      url: normalizeSentryUrl(config.url),
      project: config.project,
      organization: config.organization,
    },
  ]
}

export const updateAppConfigDsn = (source: string, dsn: string): string => {
  validatePublicDsn(dsn)
  const pattern = /(\bsentry\s*:\s*\{[^{}]*?\bdsn\s*:\s*)(['"])([^'"\r\n]*)(\2)([^{}]*\})/g
  const matches = [...source.matchAll(pattern)]

  if (matches.length !== 1) {
    throw new Error(
      `AppConfig.ts must contain exactly one simple AppConfig.sentry.dsn field; found ${matches.length}.`
    )
  }

  return source.replace(
    pattern,
    (
      _match,
      prefix: string,
      quote: string,
      _previousDsn: string,
      _closingQuote,
      suffix: string
    ) => {
      const escapedDsn = dsn.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)
      return `${prefix}${quote}${escapedDsn}${quote}${suffix}`
    }
  )
}

const getApiErrorMessage = (data: unknown, statusText: string): string => {
  if (isJsonObject(data)) {
    for (const field of ['detail', 'error', 'message']) {
      if (typeof data[field] === 'string' && data[field].trim()) return data[field].trim()
    }
  }

  return statusText || 'Sentry API request failed'
}

export class SentryApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SentryApiError'
    this.status = status
  }
}

export class SentryApiClient {
  private readonly apiUrl: URL
  private readonly fetcher: FetchLike
  private readonly token: string

  constructor(token: string, sentryUrl = DEFAULT_SENTRY_URL, fetcher: FetchLike = fetch) {
    if (!token.trim()) throw new Error('A Sentry API token is required.')
    this.token = token.trim()
    this.apiUrl = new URL('api/0/', normalizeSentryUrl(sentryUrl))
    this.fetcher = fetcher
  }

  private async request<T>(method: string, path: string, body?: JsonObject): Promise<T> {
    const response = await this.fetcher(new URL(path, this.apiUrl), {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const responseText = await response.text()
    let data: unknown

    if (responseText) {
      try {
        data = JSON.parse(responseText) as unknown
      } catch {
        if (response.ok) throw new Error('Sentry returned an invalid JSON response.')
      }
    }

    if (!response.ok) {
      throw new SentryApiError(response.status, getApiErrorMessage(data, response.statusText))
    }

    return data as T
  }

  async resolveOrganization(requestedSlug?: string): Promise<string> {
    if (requestedSlug) {
      await this.request<SentryOrganization>(
        'GET',
        `organizations/${encodeURIComponent(requestedSlug)}/`
      )
      return requestedSlug
    }

    const organizations = await this.request<SentryOrganization[]>('GET', 'organizations/')
    return selectOrganizationSlug(organizations)
  }

  async resolveTeam(organization: string, requestedSlug?: string): Promise<string> {
    const teams = await this.request<SentryTeam[]>(
      'GET',
      `organizations/${encodeURIComponent(organization)}/teams/`
    )
    return selectTeamSlug(teams, requestedSlug)
  }

  async getOrCreateProject(
    organization: string,
    team: string,
    identity: SentryAppIdentity
  ): Promise<{ created: boolean; project: SentryProject }> {
    const encodedOrganization = encodeURIComponent(organization)
    const encodedProject = encodeURIComponent(identity.projectSlug)

    try {
      const project = await this.request<SentryProject>(
        'GET',
        `projects/${encodedOrganization}/${encodedProject}/`
      )
      return { created: false, project }
    } catch (error) {
      if (!(error instanceof SentryApiError) || error.status !== 404) throw error
    }

    try {
      const project = await this.request<SentryProject>(
        'POST',
        `teams/${encodedOrganization}/${encodeURIComponent(team)}/projects/`,
        {
          default_rules: true,
          name: identity.displayName,
          platform: 'react-native',
          slug: identity.projectSlug,
        }
      )
      return { created: true, project }
    } catch (error) {
      if (!(error instanceof SentryApiError) || error.status !== 409) throw error
      const project = await this.request<SentryProject>(
        'GET',
        `projects/${encodedOrganization}/${encodedProject}/`
      )
      return { created: false, project }
    }
  }

  async getOrCreatePublicDsn(
    organization: string,
    project: string
  ): Promise<{ created: boolean; dsn: string }> {
    const path = `projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/keys/`
    const keys = await this.request<SentryClientKey[]>('GET', `${path}?status=active`)
    const existingDsn = keys.find(
      (key) => key.isActive !== false && typeof key.dsn?.public === 'string'
    )?.dsn?.public

    if (existingDsn) return { created: false, dsn: validatePublicDsn(existingDsn) }

    const key = await this.request<SentryClientKey>('POST', path, { name: 'Default' })
    if (typeof key.dsn?.public !== 'string') {
      throw new Error('Sentry created a client key without returning a public DSN.')
    }

    return { created: true, dsn: validatePublicDsn(key.dsn.public) }
  }
}
