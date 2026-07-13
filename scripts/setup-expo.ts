#!/usr/bin/env npx tsx
/**
 * Personalizes a clone of this template and links it to a new EAS project.
 *
 * Usage:
 *   npm run setup:expo
 */

import { execFileSync } from 'child_process'
import { createInterface } from 'readline/promises'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type JsonObject = Record<string, unknown>

function readJson(fileName: string): JsonObject {
  return JSON.parse(fs.readFileSync(path.join(ROOT, fileName), 'utf8')) as JsonObject
}

function writeJson(fileName: string, value: JsonObject): void {
  fs.writeFileSync(path.join(ROOT, fileName), `${JSON.stringify(value, null, 2)}\n`)
}

function getExpoConfig(appJson: JsonObject): JsonObject {
  const expo = appJson.expo
  if (!expo || typeof expo !== 'object' || Array.isArray(expo)) {
    throw new Error('app.json must contain an "expo" object.')
  }

  return expo as JsonObject
}

function setProjectId(appJson: JsonObject, projectId: string): void {
  const expo = getExpoConfig(appJson)
  const extra = (expo.extra ??= {})
  if (typeof extra !== 'object' || Array.isArray(extra)) {
    throw new Error('app.json "expo.extra" must be an object.')
  }

  const eas = ((extra as JsonObject).eas ??= {})
  if (typeof eas !== 'object' || Array.isArray(eas)) {
    throw new Error('app.json "expo.extra.eas" must be an object.')
  }

  ;(eas as JsonObject).projectId = projectId
  expo.updates = { ...(expo.updates as JsonObject), url: `https://u.expo.dev/${projectId}` }
}

function removeExistingEasProjectLink(expo: JsonObject): void {
  const extra = expo.extra
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    const eas = (extra as JsonObject).eas
    if (eas && typeof eas === 'object' && !Array.isArray(eas)) {
      delete (eas as JsonObject).projectId
      if (Object.keys(eas).length === 0) delete (extra as JsonObject).eas
    }
  }

  const updates = expo.updates
  if (updates && typeof updates === 'object' && !Array.isArray(updates)) {
    delete (updates as JsonObject).url
    if (Object.keys(updates).length === 0) delete expo.updates
  }

  delete expo.owner
}

function getProjectId(appJson: JsonObject): string | undefined {
  const expo = getExpoConfig(appJson)
  const extra = expo.extra
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return undefined

  const eas = (extra as JsonObject).eas
  if (!eas || typeof eas !== 'object' || Array.isArray(eas)) return undefined

  const projectId = (eas as JsonObject).projectId
  return typeof projectId === 'string' ? projectId : undefined
}

async function main(): Promise<void> {
  const readline = createInterface({ input: process.stdin, output: process.stdout })

  try {
    const appName = (await readline.question('App name (for example, habit-tracker): ')).trim()
    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(appName)) {
      throw new Error('Use a lowercase npm-style name, such as "habit-tracker".')
    }

    const packageJson = readJson('package.json')
    const packageLock = readJson('package-lock.json')
    const appJson = readJson('app.json')
    const expo = getExpoConfig(appJson)

    packageJson.name = appName
    packageLock.name = appName
    const rootPackage = packageLock.packages
    if (!rootPackage || typeof rootPackage !== 'object' || Array.isArray(rootPackage)) {
      throw new Error('package-lock.json must contain a "packages" object.')
    }
    const rootPackageMetadata = (rootPackage as JsonObject)['']
    if (
      !rootPackageMetadata ||
      typeof rootPackageMetadata !== 'object' ||
      Array.isArray(rootPackageMetadata)
    ) {
      throw new Error('package-lock.json must contain root package metadata.')
    }
    ;(rootPackageMetadata as JsonObject).name = appName

    expo.name = appName
    expo.slug = appName
    removeExistingEasProjectLink(expo)

    writeJson('package.json', packageJson)
    writeJson('package-lock.json', packageLock)
    writeJson('app.json', appJson)
    console.log('\nUpdated package metadata and Expo app names.')

    let projectId: string | undefined
    try {
      console.log('\nCreating a new remote EAS project...')
      execFileSync('npx', ['eas-cli@latest', 'init', '--force', '--non-interactive'], {
        cwd: ROOT,
        stdio: 'inherit',
      })
      projectId = getProjectId(readJson('app.json'))
      if (!projectId) throw new Error('EAS CLI did not write a project ID to app.json.')
    } catch (error) {
      console.log('\nUnable to create an EAS project automatically.')
      const reason = error instanceof Error ? error.message : String(error)
      console.log(`Reason: ${reason}`)
      projectId = (await readline.question('Existing Expo project ID (UUID): ')).trim()
      if (!PROJECT_ID_PATTERN.test(projectId)) {
        throw new Error('Expo project ID must be a valid UUID.')
      }
    }

    const configuredAppJson = readJson('app.json')
    setProjectId(configuredAppJson, projectId)
    writeJson('app.json', configuredAppJson)

    console.log(`\nExpo project configured: ${projectId}`)
  } finally {
    readline.close()
  }
}

void main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
