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
const platform = getArg('--platform')
const locale = getArg('--locale')
const slot = getArg('--slot')
const inputPath = getArg('--input')
const referenceArg = getArg('--reference')

if (!appSlug || !platform || !locale || slot === null || !inputPath || !referenceArg) {
  console.error(
    'Usage: node write-store-screenshot.js --app <slug> --platform <iphone|ipad|android> ' +
      '--locale <locale> --slot <number> --input <generated-image> --reference <source-image>'
  )
  process.exit(1)
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(appSlug)) {
  console.error(`Invalid app slug: ${appSlug}`)
  process.exit(1)
}
if (!['iphone', 'ipad', 'android'].includes(platform)) {
  console.error(`Unsupported platform: ${platform}`)
  process.exit(1)
}
if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(locale)) {
  console.error(`Invalid locale: ${locale}`)
  process.exit(1)
}
if (!/^\d+$/.test(slot)) {
  console.error(`Slot must be numeric: ${slot}`)
  process.exit(1)
}
if (!fs.existsSync(inputPath)) {
  console.error(`Generated image not found: ${inputPath}`)
  process.exit(1)
}

const repoRoot = path.resolve(__dirname, '../../../..')
const appsRoot = path.join(repoRoot, 'apps')
const appDir = path.join(appsRoot, appSlug)
if (path.dirname(appDir) !== appsRoot || !fs.existsSync(path.join(appDir, 'app.json'))) {
  console.error(`App not found under apps/: ${appSlug}`)
  process.exit(1)
}

const referencePath = path.resolve(repoRoot, referenceArg)
const sourceRoot = path.join(appDir, 'assets/screenshots')
if (referencePath !== sourceRoot && !referencePath.startsWith(`${sourceRoot}${path.sep}`)) {
  console.error('Reference image must belong to the selected app assets/screenshots directory')
  process.exit(1)
}
if (!fs.existsSync(referencePath)) {
  console.error(`Reference image not found: ${referencePath}`)
  process.exit(1)
}

function outputPathForTarget() {
  if (platform === 'iphone') {
    return path.join(
      appDir,
      'fastlane/ios/screenshots',
      locale,
      `${slot}_APP_IPHONE_67_${slot}.png`
    )
  }
  if (platform === 'ipad') {
    return path.join(
      appDir,
      'fastlane/ios/screenshots',
      locale,
      `${slot}_APP_IPAD_PRO_3GEN_129_${slot}.png`
    )
  }
  return path.join(
    appDir,
    'fastlane/android/metadata',
    locale,
    'images/phoneScreenshots',
    `${slot}_${locale}.png`
  )
}

async function main() {
  const reference = await sharp(referencePath).metadata()
  if (!reference.width || !reference.height) {
    throw new Error('Could not read reference dimensions')
  }

  const outputPath = outputPathForTarget()
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  await sharp(inputPath)
    .resize(reference.width, reference.height, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9 })
    .toFile(outputPath)

  const [output, stats] = await Promise.all([
    sharp(outputPath).metadata(),
    sharp(outputPath).stats(),
  ])
  if (output.width !== reference.width || output.height !== reference.height || !stats.isOpaque) {
    throw new Error('Output verification failed')
  }

  console.log(
    JSON.stringify(
      {
        app: appSlug,
        platform,
        locale,
        slot,
        reference: referencePath,
        output: outputPath,
        width: output.width,
        height: output.height,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(`Failed to write store screenshot: ${error.message}`)
  process.exit(1)
})
