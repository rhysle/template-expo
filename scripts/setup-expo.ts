#!/usr/bin/env npx tsx
/**
 * Personalizes a clone of this template and creates or links its EAS project.
 *
 * Usage:
 *   npm run setup:expo
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'

import type { AppIdentity, JsonObject } from './setup-expo-core'
import {
  applyAppIdentity,
  deriveSlug,
  getExpoConfig,
  getProjectId,
  parseEasUsername,
  setProjectId,
  validateAndroidPackage,
  validateDisplayName,
  validateIosBundleIdentifier,
  validateProjectId,
  validateScheme,
  validateSlug,
} from './setup-expo-core'

const ROOT = path.resolve(__dirname, '..')
const CONFIG_FILES = ['package.json', 'package-lock.json', 'app.json'] as const
type EasSetup = { mode: 'owner-slug'; owner: string } | { mode: 'project-id'; projectId: string }

function readJson(fileName: string): JsonObject {
  return JSON.parse(fs.readFileSync(path.join(ROOT, fileName), 'utf8')) as JsonObject
}

function writeJson(fileName: string, value: JsonObject): void {
  const target = path.join(ROOT, fileName)
  const temporary = `${target}.setup-expo.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  fs.renameSync(temporary, target)
}

function snapshotConfigFiles(): Map<string, string> {
  return new Map(
    CONFIG_FILES.map((fileName) => [fileName, fs.readFileSync(path.join(ROOT, fileName), 'utf8')])
  )
}

function restoreConfigFiles(snapshot: Map<string, string>): void {
  for (const [fileName, contents] of snapshot) {
    const target = path.join(ROOT, fileName)
    const temporary = `${target}.setup-expo.tmp`
    fs.writeFileSync(temporary, contents)
    fs.renameSync(temporary, target)
  }
}

function runEas(args: string[], captureOutput = false): string {
  return execFileSync('npx', ['eas-cli@latest', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: captureOutput ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  })
}

function runExpoConfigCheck(): void {
  execFileSync('npx', ['expo', 'config', '--type', 'public'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
}

type Readline = ReturnType<typeof createInterface>

async function ask(readline: Readline, prompt: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : ''
  const answer = (await readline.question(`${prompt}${suffix}: `)).trim()
  const value = answer || defaultValue
  if (!value) throw new Error(`${prompt} is required.`)
  return value
}

async function askValidated(
  readline: Readline,
  prompt: string,
  validate: (value: string) => void,
  defaultValue?: string
): Promise<string> {
  while (true) {
    const value = await ask(readline, prompt, defaultValue)
    try {
      validate(value)
      return value
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function confirm(readline: Readline, prompt: string): Promise<boolean> {
  const answer = (await readline.question(`${prompt} (y/N): `)).trim().toLowerCase()
  return answer === 'y' || answer === 'yes'
}

async function askIdentity(readline: Readline): Promise<AppIdentity> {
  const displayName = await askValidated(readline, 'App display name', validateDisplayName)
  const suggestedSlug = deriveSlug(displayName)
  const slug = await askValidated(readline, 'Expo project slug', validateSlug, suggestedSlug)
  const iosBundleIdentifier = await askValidated(
    readline,
    'iOS bundle identifier (for example, com.example.habittracker)',
    validateIosBundleIdentifier
  )
  const androidPackage = await askValidated(
    readline,
    'Android package name',
    validateAndroidPackage,
    iosBundleIdentifier.toLowerCase()
  )
  const scheme = await askValidated(readline, 'URL scheme', validateScheme, slug)

  return { displayName, slug, iosBundleIdentifier, androidPackage, scheme }
}

async function askEasSetup(readline: Readline): Promise<EasSetup> {
  const activeAccount = parseEasUsername(runEas(['whoami'], true))
  console.log(`\nSigned in to Expo as: ${activeAccount}`)

  const mode = await askValidated(
    readline,
    'EAS project setup (new or existing)',
    (value) => {
      if (value !== 'new' && value !== 'existing') {
        throw new Error('Enter "new" or "existing".')
      }
    },
    'new'
  )

  if (mode === 'new') {
    const owner = await ask(readline, 'Expo account owner', activeAccount)
    return { mode: 'owner-slug', owner }
  }

  const projectId = await askValidated(
    readline,
    'Existing Expo project ID (UUID)',
    validateProjectId
  )
  return { mode: 'project-id', projectId }
}

function printSummary(identity: AppIdentity, easSetup: EasSetup): void {
  console.log('\nConfiguration summary:')
  console.log(`  Display name:       ${identity.displayName}`)
  console.log(`  Project slug:       ${identity.slug}`)
  console.log(`  iOS bundle ID:      ${identity.iosBundleIdentifier}`)
  console.log(`  Android package:    ${identity.androidPackage}`)
  console.log(`  URL scheme:         ${identity.scheme}`)
  console.log(
    easSetup.mode === 'owner-slug'
      ? `  EAS project:        create or link @${easSetup.owner}/${identity.slug}`
      : `  EAS project ID:     ${easSetup.projectId}`
  )
}

async function main(): Promise<void> {
  const readline = createInterface({ input: process.stdin, output: process.stdout })

  try {
    const originalAppJson = readJson('app.json')
    const existingProjectId = getProjectId(originalAppJson)
    if (existingProjectId) {
      console.log(`⚠️  This app is already linked to EAS project ${existingProjectId}.`)
      if (!(await confirm(readline, 'Replace the current app identity and EAS link?'))) {
        console.log('\nSetup cancelled. No files were changed.')
        return
      }
    }

    const identity = await askIdentity(readline)
    const easSetup = await askEasSetup(readline)
    printSummary(identity, easSetup)
    if (!(await confirm(readline, 'Apply this configuration?'))) {
      console.log('\nSetup cancelled. No files were changed.')
      return
    }

    const snapshot = snapshotConfigFiles()
    const packageJson = readJson('package.json')
    const packageLock = readJson('package-lock.json')
    const appJson = readJson('app.json')

    try {
      applyAppIdentity(packageJson, packageLock, appJson, identity)
      writeJson('package.json', packageJson)
      writeJson('package-lock.json', packageLock)
      writeJson('app.json', appJson)

      console.log('\nConfiguring the EAS project...')
      const initArgs =
        easSetup.mode === 'owner-slug'
          ? ['init', '--account', easSetup.owner, '--force', '--non-interactive']
          : ['init', '--id', easSetup.projectId, '--force', '--non-interactive']
      runEas(initArgs)

      const configuredAppJson = readJson('app.json')
      const projectId = getProjectId(configuredAppJson)
      if (!projectId) throw new Error('EAS CLI did not write a project ID to app.json.')
      if (easSetup.mode === 'project-id' && projectId !== easSetup.projectId) {
        throw new Error(`EAS CLI linked project ${projectId}, expected ${easSetup.projectId}.`)
      }

      setProjectId(configuredAppJson, projectId)
      if (easSetup.mode === 'owner-slug') {
        getExpoConfig(configuredAppJson).owner = easSetup.owner
      }
      writeJson('app.json', configuredAppJson)

      console.log('\nVerifying the EAS link...')
      runEas(['project:info'])
      console.log('\nValidating the resolved Expo configuration...')
      runExpoConfigCheck()

      console.log(`\n✅ Expo app and EAS project configured: ${projectId}`)
      console.log('\nNative identity changed. Before running a native build:')
      console.log('  npm run prebuild:clean')
      console.log('  npm run ios   # and/or npm run android')
    } catch (error) {
      restoreConfigFiles(snapshot)
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Setup failed and local configuration files were restored.\nReason: ${reason}`
      )
    }
  } finally {
    readline.close()
  }
}

void main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
