import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getAppContext } from './app-context'
import { parseEnvironment } from './store-environment'

// EAS reads .easignore from the repository root. Build from a disposable workspace
// so parallel app builds never rewrite each other's archive rules or include secrets.
const { appRoot, repoRoot } = getAppContext()
const args = process.argv.slice(2)
if (!['build', 'build:inspect'].includes(args[0]))
  throw new Error('eas-app supports build and build:inspect only')
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'rhysle-eas-'))
try {
  const paths = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repoRoot, encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean)
  for (const relative of new Set(paths)) {
    if (
      !/^(apps\/|packages\/|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|tsconfig\.json$|eslint\.config\.mjs$|\.prettierrc$)/.test(
        relative
      )
    )
      continue
    if (
      /(^|\/)(node_modules|\.expo|dist|\.private|\.tmp)(\/|$)/.test(relative) ||
      /^apps\/[^/]+\/(ios|android)\//.test(relative)
    )
      continue
    if (
      /\.(p8|p12|jks|mobileprovision)$/.test(relative) ||
      /(^|\/)\.env(?!.*\.example$)/.test(relative) ||
      /GoogleService-Info.*\.plist$|google-services.*\.json$/.test(relative)
    )
      continue
    const source = path.join(repoRoot, relative)
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue
    const destination = path.join(stage, relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(source, destination)
  }
  const appRelative = path.relative(repoRoot, appRoot)
  const stagedApp = path.join(stage, appRelative)
  const environmentPath = path.join(appRoot, '.env.local')
  if (fs.existsSync(environmentPath)) {
    const values = parseEnvironment(fs.readFileSync(environmentPath, 'utf8'))
    if (values.SENTRY_SETUP_AUTH_TOKEN?.trim() || values.SENTRY_READ_AUTH_TOKEN?.trim())
      throw new Error(
        'Remove provisioning/investigation tokens from the app .env.local before building'
      )
  }
  for (const filename of ['.env.local', 'GoogleService-Info.plist', 'google-services.json']) {
    const source = path.join(appRoot, filename)
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(stagedApp, filename))
  }
  fs.writeFileSync(
    path.join(stage, '.easignore'),
    fs.readFileSync(path.join(repoRoot, '.easignore'), 'utf8') +
      `\n!${appRelative}/.env.local\n!${appRelative}/GoogleService-Info.plist\n!${appRelative}/google-services.json\n`
  )
  // Dynamic Expo config resolves this workspace package before dependencies are installed.
  fs.mkdirSync(path.join(stage, 'node_modules/@rhysle'), { recursive: true })
  fs.symlinkSync(
    path.join(stage, 'packages/tooling'),
    path.join(stage, 'node_modules/@rhysle/tooling'),
    'dir'
  )
  // Tooling config needs Expo during local archive inspection; use the current install
  // for configuration evaluation only. node_modules never enters the upload archive.
  for (const name of fs.readdirSync(path.join(repoRoot, 'node_modules'))) {
    if (name === '@rhysle') continue
    fs.symlinkSync(
      path.join(repoRoot, 'node_modules', name),
      path.join(stage, 'node_modules', name),
      'dir'
    )
  }
  for (let i = 0; i < args.length - 1; i++) {
    if (['--output', '-o'].includes(args[i])) args[i + 1] = path.resolve(appRoot, args[i + 1])
  }
  if (args.includes('--local') && !args.includes('--output') && !args.includes('-o')) {
    const output = path.join(appRoot, 'dist', args.includes('android') ? 'app.aab' : 'app.ipa')
    fs.mkdirSync(path.dirname(output), { recursive: true })
    args.push('--output', output)
  }
  const result = spawnSync('eas', args, {
    cwd: stagedApp,
    stdio: 'inherit',
    env: { ...process.env, EAS_NO_VCS: '1', EAS_PROJECT_ROOT: stage },
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  fs.rmSync(stage, { recursive: true, force: true })
}
