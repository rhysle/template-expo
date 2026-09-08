import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { parseArgs } from 'node:util'

import type { CoreConfig } from '@rhysle/core/runtime/config'
import type { ExpoConfig } from 'expo/config'

const repoRoot = path.resolve(__dirname, '../../..')
interface AppPackage {
  name: string
  version: string
  dependencies: Record<string, string>
  expo: { autolinking: { ios: { exclude: string[] }; android: { exclude: string[] } } }
}
interface EasConfig {
  submit?: Record<string, unknown>
}
const readJson = <T extends object>(file: string): T =>
  JSON.parse(fs.readFileSync(file, 'utf8')) as T
export const resetAppConfiguration = (
  root: string,
  slug: string,
  name: string,
  bundleId: string
): void => {
  const appFile = path.join(root, 'app.json')
  const app = readJson<{ expo: ExpoConfig }>(appFile)
  Object.assign(app.expo, { name, slug, scheme: slug, version: '1.0.0' })
  app.expo.ios ??= {}
  app.expo.android ??= {}
  app.expo.ios.bundleIdentifier = bundleId
  app.expo.android.package = bundleId
  delete app.expo.ios.buildNumber
  delete app.expo.android.versionCode
  delete app.expo.ios.googleServicesFile
  delete app.expo.android.googleServicesFile
  delete app.expo.owner
  delete app.expo.updates
  if (app.expo.extra) delete app.expo.extra.eas
  app.expo.plugins = (app.expo.plugins ?? [])
    .filter(
      (plugin) =>
        !['react-native-google-mobile-ads', 'expo-tracking-transparency'].includes(
          Array.isArray(plugin) ? (plugin[0] ?? '') : plugin
        )
    )
    .map((plugin): NonNullable<ExpoConfig['plugins']>[number] => {
      if (Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo')
        return [plugin[0], { url: 'https://sentry.io/' }]
      return plugin
    })
  fs.writeFileSync(appFile, JSON.stringify(app, null, 2) + '\n')
  const pkgFile = path.join(root, 'package.json')
  const pkg = readJson<AppPackage>(pkgFile)
  pkg.name = `@rhysle/${slug}`
  pkg.version = '1.0.0'
  delete pkg.dependencies['@rhysle/ads']
  delete pkg.dependencies['react-native-google-mobile-ads']
  delete pkg.dependencies['expo-tracking-transparency']
  pkg.expo.autolinking = {
    ios: { exclude: ['react-native-google-mobile-ads', 'expo-tracking-transparency'] },
    android: { exclude: ['react-native-google-mobile-ads', 'expo-tracking-transparency'] },
  }
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n')
  const configFile = path.join(root, 'src/configs/AppConfig.ts')
  const { AppConfig } = createRequire(path.join(root, 'package.json'))(configFile) as {
    AppConfig: CoreConfig
  }
  const config = structuredClone(AppConfig)
  config.iosAppStoreId = ''
  config.revenueCat = {
    testStoreApiKey: '',
    iosApiKey: '',
    androidApiKey: '',
    entitlementId: 'premium',
  }
  config.sentry.dsn = ''
  config.ads.enabled = false
  for (const platform of ['ios', 'android'] as const)
    config.ads[platform] = { appId: '', bannerAdUnitId: '', interstitialAdUnitId: '' }
  config.otaUpdate.enabled = false
  fs.writeFileSync(
    configFile,
    `// App-owned configuration. Run setup commands before release.\nexport const AppConfig = ${JSON.stringify(config, null, 2).replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, '$1$2:')} as const\n`
  )
  execFileSync('pnpm', ['exec', 'prettier', '--write', configFile, '--log-level', 'error'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  fs.writeFileSync(
    path.join(root, 'src/services/ads/index.ts'),
    "export * from '@rhysle/core/services/ads/disabled'\n"
  )
  const monetizationFile = path.join(root, 'src/configs/monetization.ts')
  fs.writeFileSync(
    monetizationFile,
    fs.readFileSync(monetizationFile, 'utf8').replace(/^\s*appleReviewScreenshotPath:.*\n/gm, '')
  )
  const easFile = path.join(root, 'eas.json')
  const eas = readJson<EasConfig>(easFile)
  eas.submit = { production: {} }
  fs.writeFileSync(easFile, JSON.stringify(eas, null, 2) + '\n')
  const ignore = fs.readFileSync(path.join(repoRoot, '.easignore'), 'utf8')
  fs.writeFileSync(
    path.join(root, '.easignore'),
    `${ignore}!apps/${slug}/.env.local\n!apps/${slug}/GoogleService-Info.plist\n!apps/${slug}/google-services.json\n`
  )
}

const main = (): void => {
  const { values, positionals } = parseArgs({
    options: { name: { type: 'string' }, 'bundle-id': { type: 'string' } },
    allowPositionals: true,
  })
  const [slug] = positionals
  const name = values.name?.trim()
  const bundleId = values['bundle-id']
  if (
    positionals.length !== 1 ||
    !slug ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) ||
    !name ||
    !bundleId ||
    !/^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(bundleId)
  )
    throw new Error(
      'Usage: pnpm create:app <slug> --name "Display Name" --bundle-id com.company.app'
    )
  const appsRoot = path.join(repoRoot, 'apps')
  const destination = path.join(appsRoot, slug)
  if (fs.existsSync(destination)) throw new Error(`App directory already exists: ${slug}`)
  for (const entry of fs.readdirSync(appsRoot)) {
    const appFile = path.join(appsRoot, entry, 'app.json')
    if (!fs.existsSync(appFile)) continue
    const { expo } = readJson<{ expo: ExpoConfig }>(appFile)
    const pkg = readJson<AppPackage>(path.join(appsRoot, entry, 'package.json'))
    const schemes = Array.isArray(expo.scheme) ? expo.scheme : [expo.scheme]
    if (
      pkg.name === `@rhysle/${slug}` ||
      expo.slug === slug ||
      schemes.some(
        (scheme) =>
          scheme && [scheme, `${scheme}.dev`].some((value) => [slug, `${slug}.dev`].includes(value))
      ) ||
      [expo.ios?.bundleIdentifier, expo.android?.package].some(
        (id) =>
          id && [id, `${id}.dev`].some((value) => [bundleId, `${bundleId}.dev`].includes(value))
      )
    )
      throw new Error(`App identity conflicts with ${entry}`)
  }
  const staging = fs.mkdtempSync(path.join(appsRoot, '.generate-'))
  try {
    const starter = path.join(appsRoot, 'starter')
    const starterBaseComponents = path.join(starter, 'src/components/base')
    if (fs.existsSync(starterBaseComponents))
      throw new Error(
        'Starter must import shared base components through @rhysle/core/components/base; remove src/components/base'
      )
    const starterTsConfig = readJson<{
      compilerOptions?: { paths?: Record<string, string[]> }
    }>(path.join(starter, 'tsconfig.json'))
    const corePathAlias = Object.entries(starterTsConfig.compilerOptions?.paths ?? {}).find(
      ([, targets]) => targets.some((target) => target.includes('packages/core'))
    )
    if (corePathAlias)
      throw new Error(
        `Starter must import @rhysle/core through package exports; remove the ${corePathAlias[0]} TypeScript path alias`
      )
    const starterPackage = readJson<AppPackage>(path.join(starter, 'package.json'))
    if (starterPackage.dependencies['@rhysle/core'] !== 'workspace:*')
      throw new Error('Starter must depend on @rhysle/core with workspace:*')
    for (const entry of [
      'src',
      'assets',
      'app.json',
      'app.config.ts',
      'eas.json',
      'metro.config.js',
      'tsconfig.json',
      'eslint.config.mjs',
      'package.json',
      '.env.local.example',
      '.env.fastlane.example',
      'fastlane/Fastfile',
      'fastlane/Appfile',
      'fastlane/ios/app_store_config.json',
      'fastlane/ios/metadata',
      'fastlane/android/metadata',
      'fastlane/monetization/localizations',
    ]) {
      const source = path.join(starter, entry)
      if (!fs.existsSync(source)) continue
      const target = path.join(staging, entry)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.cpSync(source, target, {
        recursive: true,
        filter: (file) => !file.includes('/review_information/') || file.endsWith('/notes.txt'),
      })
    }
    resetAppConfiguration(staging, slug, name, bundleId)
    fs.writeFileSync(
      path.join(staging, 'README.md'),
      `# ${name}\n\nRun pnpm install at the repository root.\n\nFrom this app directory, configure app copy/assets/legal links, then run pnpm setup:expo, pnpm setup:firebase, and pnpm setup:sentry with the documented machine credentials. Configure RevenueCat and store listings separately. Run pnpm setup:ads only after choosing an ads policy, then regenerate native projects. No remote services have been provisioned.\n`
    )
    fs.renameSync(staging, destination)
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true })
    throw error
  }
  console.log(
    `Created apps/${slug}. Next: pnpm install, then pnpm --filter @rhysle/${slug} setup:expo`
  )
}
if (require.main === module) main()
