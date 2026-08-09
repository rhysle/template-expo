#!/usr/bin/env npx tsx
/**
 * Creates or reuses a Sentry project for the Expo app and writes its local configuration.
 *
 * Prerequisite: run npm run setup:expo and provide the reusable SENTRY_SETUP_AUTH_TOKEN from a
 * configurable Internal Integration through the local process environment. The fixed org:ci
 * SENTRY_AUTH_TOKEN remains reserved for build/update source-map uploads.
 *
 * Usage:
 *   npm run setup:sentry
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { loadProjectEnv } from '@expo/env'

import type { JsonObject } from './setup-sentry-core'
import {
  getConfiguredSentryOrganization,
  getSentryAppIdentity,
  normalizeSentryUrl,
  SentryApiClient,
  SentryApiError,
  updateAppConfigDsn,
  updateSentryPlugin,
} from './setup-sentry-core'

const ROOT = path.resolve(__dirname, '..')
const APP_JSON_PATH = path.join(ROOT, 'app.json')
const APP_CONFIG_PATH = path.join(ROOT, 'src/configs/AppConfig.ts')

const readJson = (target: string): JsonObject =>
  JSON.parse(fs.readFileSync(target, 'utf8')) as JsonObject

const writeFileAtomically = (target: string, contents: string): void => {
  const temporary = `${target}.setup-sentry.tmp`
  fs.writeFileSync(temporary, contents)
  fs.renameSync(temporary, target)
}

const validateExpoConfig = (): void => {
  execFileSync('npx', ['expo', 'config', '--type', 'public'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
}

const describeSentryError = (error: unknown): string => {
  if (!(error instanceof SentryApiError)) {
    return error instanceof Error ? error.message : String(error)
  }

  if (error.status === 401) {
    return 'Sentry rejected SENTRY_SETUP_AUTH_TOKEN. Replace the token and try again.'
  }

  if (error.status === 403) {
    return (
      'SENTRY_SETUP_AUTH_TOKEN does not have permission for this operation. ' +
      `Sentry says: ${error.message}`
    )
  }

  return `Sentry API request failed (${error.status}): ${error.message}`
}

const main = async (): Promise<void> => {
  loadProjectEnv(ROOT, { silent: true })

  const token = process.env.SENTRY_SETUP_AUTH_TOKEN?.trim()
  if (!token) {
    throw new Error(
      'SENTRY_SETUP_AUTH_TOKEN is required. Sentry Organization Tokens are limited to org:ci ' +
        'and cannot create projects. Create an Internal Integration token with Organization Read ' +
        'and Team Admin plus Project Read & Write, keep it in a secure local environment, and try again.'
    )
  }

  const originalAppJson = fs.readFileSync(APP_JSON_PATH, 'utf8')
  const originalAppConfig = fs.readFileSync(APP_CONFIG_PATH, 'utf8')
  const appJson = readJson(APP_JSON_PATH)
  const identity = getSentryAppIdentity(appJson)
  const sentryUrl = normalizeSentryUrl(process.env.SENTRY_URL?.trim() || undefined)
  const requestedOrganization =
    process.env.SENTRY_ORG?.trim() || getConfiguredSentryOrganization(appJson)
  const requestedTeam = process.env.SENTRY_TEAM?.trim() || undefined
  const api = new SentryApiClient(token, sentryUrl)

  console.log(`\nConfiguring Sentry for ${identity.displayName} (${identity.projectSlug})...`)

  const organization = await api.resolveOrganization(requestedOrganization)
  console.log(`  Organization: ${organization}`)

  const team = await api.resolveTeam(organization, requestedTeam)
  console.log(`  Team:         ${team}`)

  const { created: projectCreated, project } = await api.getOrCreateProject(
    organization,
    team,
    identity
  )
  console.log(`  Project:      ${project.slug} (${projectCreated ? 'created' : 'reused'})`)

  const { created: keyCreated, dsn } = await api.getOrCreatePublicDsn(organization, project.slug)
  console.log(`  Client key:   ${keyCreated ? 'created' : 'reused'}`)

  updateSentryPlugin(appJson, {
    organization,
    project: project.slug,
    url: sentryUrl,
  })
  const updatedAppConfig = updateAppConfigDsn(originalAppConfig, dsn)
  const updatedAppJson = `${JSON.stringify(appJson, null, 2)}\n`

  try {
    writeFileAtomically(APP_JSON_PATH, updatedAppJson)
    writeFileAtomically(APP_CONFIG_PATH, updatedAppConfig)

    console.log('\nValidating the resolved Expo configuration...')
    validateExpoConfig()
  } catch (error) {
    writeFileAtomically(APP_JSON_PATH, originalAppJson)
    writeFileAtomically(APP_CONFIG_PATH, originalAppConfig)
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Local setup failed and configuration files were restored.\nReason: ${reason}`)
  }

  console.log(`\n✅ Sentry configured: ${organization}/${project.slug}`)
  console.log(
    'Keep SENTRY_SETUP_AUTH_TOKEN securely for future app forks; never expose it to the app or EAS builds.'
  )
  console.log('Run npm run prebuild:clean before the next local native build.')
}

void main().catch((error: unknown) => {
  console.error(`\n❌ ${describeSentryError(error)}`)
  process.exitCode = 1
})
