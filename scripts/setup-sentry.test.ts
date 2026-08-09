import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  FetchLike,
  JsonObject,
  SentryOrganization,
  SentryTeam,
} from './setup-sentry-core'
import {
  getConfiguredSentryOrganization,
  getSentryAppIdentity,
  selectOrganizationSlug,
  selectTeamSlug,
  SentryApiClient,
  updateAppConfigDsn,
  updateSentryPlugin,
} from './setup-sentry-core'

const createAppJson = (): JsonObject => ({
  expo: {
    name: 'Habit Tracker',
    slug: 'habit-tracker',
    extra: { eas: { projectId: '123e4567-e89b-42d3-a456-426614174000' } },
    plugins: [
      [
        '@sentry/react-native/expo',
        { url: 'https://sentry.io/', project: 'template-expo', organization: 'template-org' },
      ],
    ],
  },
})

const jsonResponse = (status: number, value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

void test('reads the Expo identity only after setup:expo has linked EAS', () => {
  assert.deepEqual(getSentryAppIdentity(createAppJson()), {
    displayName: 'Habit Tracker',
    projectSlug: 'habit-tracker',
  })

  assert.throws(
    () => getSentryAppIdentity({ expo: { name: 'Habit Tracker', slug: 'habit-tracker' } }),
    /setup:expo first/
  )
})

void test('selects one organization and requires SENTRY_ORG for ambiguous tokens', () => {
  const organizations: SentryOrganization[] = [
    { id: '1', name: 'Acme', slug: 'acme' },
    { id: '2', name: 'Example', slug: 'example' },
  ]

  assert.equal(selectOrganizationSlug([organizations[0]]), 'acme')
  assert.equal(selectOrganizationSlug(organizations, 'example'), 'example')
  assert.throws(() => selectOrganizationSlug(organizations), /Set SENTRY_ORG/)
  assert.throws(() => selectOrganizationSlug(organizations, 'missing'), /cannot access/)
})

void test('derives the Sentry organization from the Expo plugin configuration', () => {
  assert.equal(getConfiguredSentryOrganization(createAppJson()), 'template-org')

  const appJson = createAppJson()
  const expo = appJson.expo as JsonObject
  const plugins = expo.plugins as unknown[]
  plugins[0] = ['@sentry/react-native/expo', { project: 'habit-tracker' }]

  assert.equal(getConfiguredSentryOrganization(appJson), undefined)
})

void test('selects one team and requires SENTRY_TEAM for ambiguous organizations', () => {
  const teams: SentryTeam[] = [
    { id: '1', name: 'Mobile', slug: 'mobile' },
    { id: '2', name: 'Backend', slug: 'backend' },
  ]

  assert.equal(selectTeamSlug([teams[0]]), 'mobile')
  assert.equal(selectTeamSlug(teams, 'backend'), 'backend')
  assert.throws(() => selectTeamSlug(teams), /Set SENTRY_TEAM/)
  assert.throws(() => selectTeamSlug(teams, 'missing'), /cannot access/)
  assert.throws(() => selectTeamSlug([]), /does not have any teams/)
})

void test('updates only the Sentry plugin while preserving its other options', () => {
  const appJson = createAppJson()
  const expo = appJson.expo as JsonObject
  const plugins = expo.plugins as unknown[]
  const plugin = plugins[0] as [string, JsonObject]
  plugin[1].uploadNativeSymbols = true

  updateSentryPlugin(appJson, {
    organization: 'acme',
    project: 'habit-tracker',
    url: 'https://sentry.io',
  })

  assert.deepEqual(plugins[0], [
    '@sentry/react-native/expo',
    {
      url: 'https://sentry.io/',
      project: 'habit-tracker',
      organization: 'acme',
      uploadNativeSymbols: true,
    },
  ])
})

void test('updates exactly one AppConfig Sentry DSN', () => {
  const source = `export const AppConfig = {
  sentry: {
    dsn: 'https://old@example.ingest.sentry.io/1',
  },
  other: { dsn: 'unchanged' },
} as const
`

  const updated = updateAppConfigDsn(source, 'https://public-key@o123.ingest.sentry.io/456')

  assert.match(updated, /dsn: 'https:\/\/public-key@o123\.ingest\.sentry\.io\/456'/)
  assert.match(updated, /other: \{ dsn: 'unchanged' \}/)
})

void test('creates a missing project and reuses the project after a creation race', async () => {
  const requests: { body?: string; method?: string; url: string }[] = []
  const responses = [
    jsonResponse(404, { detail: 'Not found' }),
    jsonResponse(409, { detail: 'Project slug already exists' }),
    jsonResponse(200, {
      id: '10',
      name: 'Habit Tracker',
      platform: 'react-native',
      slug: 'habit-tracker',
    }),
  ]
  const fetcher: FetchLike = async (url, init) => {
    requests.push({ body: init.body, method: init.method, url: url.toString() })
    return responses.shift()!
  }
  const api = new SentryApiClient('test-token', 'https://sentry.io/', fetcher)

  const result = await api.getOrCreateProject('acme', 'mobile', {
    displayName: 'Habit Tracker',
    projectSlug: 'habit-tracker',
  })

  assert.equal(result.created, false)
  assert.equal(result.project.slug, 'habit-tracker')
  assert.deepEqual(
    requests.map(({ method, url }) => [method, url]),
    [
      ['GET', 'https://sentry.io/api/0/projects/acme/habit-tracker/'],
      ['POST', 'https://sentry.io/api/0/teams/acme/mobile/projects/'],
      ['GET', 'https://sentry.io/api/0/projects/acme/habit-tracker/'],
    ]
  )
  assert.deepEqual(JSON.parse(requests[1].body!), {
    default_rules: true,
    name: 'Habit Tracker',
    platform: 'react-native',
    slug: 'habit-tracker',
  })
})

void test('reuses an active public DSN and creates a key only when needed', async () => {
  const existingFetcher: FetchLike = async () =>
    jsonResponse(200, [
      {
        isActive: true,
        dsn: { public: 'https://public-key@o123.ingest.sentry.io/456' },
      },
    ])
  const existingApi = new SentryApiClient('test-token', undefined, existingFetcher)

  assert.deepEqual(await existingApi.getOrCreatePublicDsn('acme', 'habit-tracker'), {
    created: false,
    dsn: 'https://public-key@o123.ingest.sentry.io/456',
  })

  const methods: string[] = []
  const responses = [
    jsonResponse(200, []),
    jsonResponse(201, {
      isActive: true,
      dsn: { public: 'https://new-key@o123.ingest.sentry.io/456' },
    }),
  ]
  const createFetcher: FetchLike = async (_url, init) => {
    methods.push(init.method)
    return responses.shift()!
  }
  const createApi = new SentryApiClient('test-token', undefined, createFetcher)

  assert.deepEqual(await createApi.getOrCreatePublicDsn('acme', 'habit-tracker'), {
    created: true,
    dsn: 'https://new-key@o123.ingest.sentry.io/456',
  })
  assert.deepEqual(methods, ['GET', 'POST'])
})
