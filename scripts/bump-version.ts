#!/usr/bin/env npx tsx
/**
 * Bump the app's public release version everywhere it is stored.
 *
 * Usage:
 *   npx tsx scripts/bump-version.ts patch
 *   npx tsx scripts/bump-version.ts minor
 *   npx tsx scripts/bump-version.ts major
 *   npx tsx scripts/bump-version.ts patch --dry-run
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const PACKAGE_JSON = path.join(ROOT, 'package.json')
const PACKAGE_LOCK_JSON = path.join(ROOT, 'package-lock.json')
const APP_JSON = path.join(ROOT, 'app.json')

type BumpType = 'patch' | 'minor' | 'major'
type JsonObject = Record<string, unknown>

const BUMP_TYPES = new Set<BumpType>(['patch', 'minor', 'major'])

function readJson(filePath: string): JsonObject {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonObject
}

function writeJson(filePath: string, value: JsonObject) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8')
}

function assertVersion(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`${label} must be a semver version like 1.0.1`)
  }

  return value
}

function getNestedVersion(root: JsonObject, pathParts: string[], label: string): string {
  let current: unknown = root

  for (const part of pathParts) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      throw new Error(`${label} was not found`)
    }
    current = (current as JsonObject)[part]
  }

  return assertVersion(current, label)
}

function bumpVersion(version: string, bumpType: BumpType): string {
  const [major, minor, patch] = version.split('.').map(Number)

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
  }
}

function main() {
  const bumpType = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')

  if (!BUMP_TYPES.has(bumpType as BumpType)) {
    console.error('Usage: npx tsx scripts/bump-version.ts <patch|minor|major> [--dry-run]')
    process.exit(1)
  }

  const packageJson = readJson(PACKAGE_JSON)
  const packageLockJson = readJson(PACKAGE_LOCK_JSON)
  const appJson = readJson(APP_JSON)

  const packageVersion = assertVersion(packageJson.version, 'package.json version')
  const packageLockVersion = assertVersion(packageLockJson.version, 'package-lock.json version')
  const packageLockRootVersion = getNestedVersion(
    packageLockJson,
    ['packages', '', 'version'],
    'package-lock.json root package version'
  )
  const appVersion = getNestedVersion(appJson, ['expo', 'version'], 'app.json expo.version')

  const versions = new Set([packageVersion, packageLockVersion, packageLockRootVersion, appVersion])

  if (versions.size !== 1) {
    throw new Error(
      [
        'Version fields are out of sync:',
        `  package.json: ${packageVersion}`,
        `  package-lock.json: ${packageLockVersion}`,
        `  package-lock.json packages[""]: ${packageLockRootVersion}`,
        `  app.json expo.version: ${appVersion}`,
      ].join('\n')
    )
  }

  const nextVersion = bumpVersion(packageVersion, bumpType as BumpType)

  if (dryRun) {
    console.log(`Would bump ${packageVersion} -> ${nextVersion}`)
    return
  }

  packageJson.version = nextVersion
  packageLockJson.version = nextVersion
  ;((packageLockJson.packages as JsonObject)[''] as JsonObject).version = nextVersion
  ;(appJson.expo as JsonObject).version = nextVersion

  writeJson(PACKAGE_JSON, packageJson)
  writeJson(PACKAGE_LOCK_JSON, packageLockJson)
  writeJson(APP_JSON, appJson)

  console.log(`Bumped ${packageVersion} -> ${nextVersion}`)
  console.log('Next: npm run release:verify-config')
}

main()
