#!/usr/bin/env npx tsx
/**
 * Font setup script
 *
 * Reads FONT_NAME from src/configs/fonts.ts, installs the corresponding
 * @expo-google-fonts package, and updates app.json so fonts are embedded
 * in production builds.
 *
 * Usage:
 *   npx tsx scripts/setup-font.ts
 *
 * What it does:
 *   1. Imports FONT_NAME from src/configs/fonts.ts
 *   2. Derives package name (@expo-google-fonts/open-sans) from FONT_NAME
 *   3. Installs the package via `npx expo install`
 *   4. Requires every configured .ttf weight variant
 *   5. Updates app.json with iOS font files and one weighted Android font family
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import { FONT_NAME } from '../src/configs/fonts'

const ROOT = path.resolve(__dirname, '..')

// Weight config: semantic key → Google Font weight suffix
const WEIGHTS = [
  { key: 'light', suffix: '300Light', weight: 300 },
  { key: 'regular', suffix: '400Regular', weight: 400 },
  { key: 'medium', suffix: '500Medium', weight: 500 },
  { key: 'semibold', suffix: '600SemiBold', weight: 600 },
  { key: 'bold', suffix: '700Bold', weight: 700 },
] as const

function toKebabCase(name: string): string {
  // "OpenSans" → "open-sans", "FiraSans" → "fira-sans"
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2') // PascalCase → spaced
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function main() {
  const prefix = FONT_NAME
  const packageSuffix = toKebabCase(prefix)
  const packageName = `@expo-google-fonts/${packageSuffix}`

  console.log(`\n🔤 Setting up font: ${prefix}`)
  console.log(`   Package: ${packageName}\n`)

  // 1. Install the font package
  console.log('📦 Installing package...')
  try {
    execSync(`npx expo install ${packageName}`, { cwd: ROOT, stdio: 'inherit' })
  } catch {
    console.error(`\n❌ Failed to install ${packageName}. Is the font name correct?`)
    console.error('   Browse fonts at: https://fonts.google.com/')
    process.exit(1)
  }

  // 2. Check which .ttf files exist
  // Supports two package layouts:
  //   - Flat:   <package>/<FontName>.ttf
  //   - Nested: <package>/<WeightSuffix>/<FontName>.ttf  (newer packages)
  const packageDir = path.join(ROOT, 'node_modules', packageName)
  const fontFiles: { key: string; name: string; relativePath: string; weight: number }[] = []
  const missingVariants: { key: string; suffix: string }[] = []

  for (const { key, suffix, weight } of WEIGHTS) {
    const fontName = `${prefix}_${suffix}`
    const ttfFile = `${fontName}.ttf`

    // Try nested layout first (e.g., @expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf)
    const nestedPath = path.join(packageDir, suffix, ttfFile)
    // Then flat layout (e.g., @expo-google-fonts/inter/Inter_400Regular.ttf)
    const flatPath = path.join(packageDir, ttfFile)

    let relativePath: string
    if (fs.existsSync(nestedPath)) {
      relativePath = `./node_modules/${packageName}/${suffix}/${ttfFile}`
    } else if (fs.existsSync(flatPath)) {
      relativePath = `./node_modules/${packageName}/${ttfFile}`
    } else {
      missingVariants.push({ key, suffix })
      continue
    }

    fontFiles.push({ key, name: fontName, relativePath, weight })
  }

  // 3. Report missing variants
  if (missingVariants.length > 0) {
    console.error(`\n❌ Missing ${missingVariants.length} required weight variant(s):`)
    missingVariants.forEach(({ key, suffix }) => {
      console.error(`     • ${key} (${prefix}_${suffix}.ttf)`)
    })
    console.error(`\n   Available files in ${packageDir}:`)
    const entries = fs
      .readdirSync(packageDir)
      .filter(
        (f) =>
          !f.startsWith('.') && !f.endsWith('.js') && !f.endsWith('.json') && !f.endsWith('.d.ts')
      )
    entries.forEach((f) => console.error(`     ${f}`))
    console.error(
      '\n   Choose a family that supplies every required weight or update the template weight set.\n'
    )
    process.exit(1)
  }

  console.log(`✅ Found ${fontFiles.length}/${WEIGHTS.length} weight variant(s)\n`)

  // 4. Update app.json — expo-font plugin
  const appJsonPath = path.join(ROOT, 'app.json')
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'))
  const plugins: unknown[] = appJson.expo.plugins

  // Find and replace the expo-font plugin entry
  const fontPluginIndex = plugins.findIndex(
    (p) => p === 'expo-font' || (Array.isArray(p) && p[0] === 'expo-font')
  )

  const fontPaths = fontFiles.map((f) => f.relativePath)
  const fontPluginEntry = [
    'expo-font',
    {
      ios: { fonts: fontPaths },
      android: {
        fonts: [
          {
            fontFamily: prefix,
            fontDefinitions: fontFiles.map(({ relativePath, weight }) => ({
              path: relativePath,
              weight,
            })),
          },
        ],
      },
    },
  ]

  if (fontPluginIndex !== -1) {
    plugins[fontPluginIndex] = fontPluginEntry
  } else {
    plugins.push(fontPluginEntry)
  }

  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n')
  console.log('✏️  Updated app.json (expo-font plugin)\n')

  // 5. Done
  console.log(`✅ Font "${prefix}" is ready!`)
  console.log('')
  console.log('   Dev:  Fonts load over the network — just start the dev server.')
  console.log('   Prod: Run `npx expo prebuild --clean` to embed fonts natively.')
  console.log('')
}

main()
