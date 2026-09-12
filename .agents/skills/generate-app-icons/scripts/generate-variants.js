#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const args = process.argv.slice(2)
function getArg(flag) {
  const index = args.indexOf(flag)
  return index === -1 ? null : args[index + 1]
}

const appSlug = getArg('--app')
const sourcePath = getArg('--source')
const androidForegroundPath = getArg('--android-foreground')
const backgroundColor = getArg('--background-color')

if (!appSlug || !sourcePath || !androidForegroundPath || !backgroundColor) {
  console.error(
    'Usage: node generate-variants.js --app <slug> --source <ios.png> ' +
      '--android-foreground <foreground.png> --background-color <#RRGGBB>'
  )
  process.exit(1)
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(appSlug)) {
  console.error(`Invalid app slug: ${appSlug}`)
  process.exit(1)
}

if (!/^#[0-9a-f]{6}$/i.test(backgroundColor)) {
  console.error(`Android background color must be an opaque #RRGGBB value: ${backgroundColor}`)
  process.exit(1)
}

const repoRoot = path.resolve(__dirname, '../../../..')
const appsRoot = path.join(repoRoot, 'apps')
const appDir = path.join(appsRoot, appSlug)

if (path.dirname(appDir) !== appsRoot || !fs.existsSync(path.join(appDir, 'app.json'))) {
  console.error(`App not found under apps/: ${appSlug}`)
  process.exit(1)
}

for (const [label, filePath] of [
  ['iOS source', sourcePath],
  ['Android foreground', androidForegroundPath],
]) {
  if (!fs.existsSync(filePath)) {
    console.error(`${label} file not found: ${filePath}`)
    process.exit(1)
  }
}

const outputDir = path.join(appDir, 'assets/icons')
const playStoreOutputPath = path.join(appDir, 'fastlane/android/metadata/en-US/images/icon.png')
const iconSize = 1024
const splashCornerRadius = Math.round(iconSize * 0.2)

async function assertSquareImage(filePath, label, alphaRequirement) {
  const image = sharp(filePath)
  const [metadata, stats] = await Promise.all([image.metadata(), image.clone().stats()])
  if (metadata.format !== 'png') {
    throw new Error(`${label} must be PNG; received ${metadata.format || 'unknown'}`)
  }
  if (!metadata.width || metadata.width !== metadata.height) {
    throw new Error(
      `${label} must be square; received ${metadata.width || '?'}x${metadata.height || '?'}`
    )
  }
  if (alphaRequirement === 'opaque' && !stats.isOpaque) {
    throw new Error(`${label} must be fully opaque`)
  }
  if (alphaRequirement === 'transparent' && stats.isOpaque) {
    throw new Error(`${label} must contain transparency`)
  }
}

async function writeOpaquePng(source, size, destination, transform = (pipeline) => pipeline) {
  const pipeline = sharp(source).resize(size, size, { fit: 'cover' }).removeAlpha()
  await transform(pipeline).png().toFile(destination)
}

async function main() {
  await Promise.all([
    assertSquareImage(sourcePath, 'iOS source', 'opaque'),
    assertSquareImage(androidForegroundPath, 'Android foreground', 'transparent'),
  ])

  fs.mkdirSync(outputDir, { recursive: true })
  fs.mkdirSync(path.dirname(playStoreOutputPath), { recursive: true })

  const iosIconPath = path.join(outputDir, 'ios-icon.png')
  await writeOpaquePng(sourcePath, iconSize, iosIconPath)

  const mask = Buffer.from(`
    <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}">
      <rect width="${iconSize}" height="${iconSize}" rx="${splashCornerRadius}" ry="${splashCornerRadius}" fill="#fff" />
    </svg>
  `)
  await sharp(iosIconPath)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(path.join(outputDir, 'splash-icon.png'))

  await writeOpaquePng(
    sourcePath,
    iconSize,
    path.join(outputDir, 'ios-icon-tinted.png'),
    (pipeline) => pipeline.grayscale()
  )

  await sharp(androidForegroundPath)
    .resize(iconSize, iconSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toFile(path.join(outputDir, 'android-icon-adaptive.png'))

  await writeOpaquePng(sourcePath, 512, playStoreOutputPath)

  console.log(
    JSON.stringify(
      {
        app: appSlug,
        backgroundColor: backgroundColor.toUpperCase(),
        outputs: [
          path.join(outputDir, 'ios-icon.png'),
          path.join(outputDir, 'splash-icon.png'),
          path.join(outputDir, 'ios-icon-tinted.png'),
          path.join(outputDir, 'android-icon-adaptive.png'),
          playStoreOutputPath,
        ],
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(`Failed to generate icon variants: ${error.message}`)
  process.exit(1)
})
