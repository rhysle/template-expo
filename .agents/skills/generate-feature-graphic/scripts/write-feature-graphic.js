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
const inputPath = getArg('--input')

if (!appSlug || !inputPath) {
  console.error('Usage: node write-feature-graphic.js --app <slug> --input <generated-image>')
  process.exit(1)
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(appSlug)) {
  console.error(`Invalid app slug: ${appSlug}`)
  process.exit(1)
}

if (!fs.existsSync(inputPath)) {
  console.error(`Input image not found: ${inputPath}`)
  process.exit(1)
}

const repoRoot = path.resolve(__dirname, '../../../..')
const appsRoot = path.join(repoRoot, 'apps')
const appDir = path.join(appsRoot, appSlug)

if (path.dirname(appDir) !== appsRoot || !fs.existsSync(path.join(appDir, 'app.json'))) {
  console.error(`App not found under apps/: ${appSlug}`)
  process.exit(1)
}

const outputPath = path.join(appDir, 'fastlane/android/metadata/en-US/images/featureGraphic.png')

async function main() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  await sharp(inputPath)
    .resize(1024, 500, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9 })
    .toFile(outputPath)

  const [metadata, stats] = await Promise.all([
    sharp(outputPath).metadata(),
    sharp(outputPath).stats(),
  ])
  if (metadata.width !== 1024 || metadata.height !== 500 || !stats.isOpaque) {
    throw new Error('Output verification failed')
  }

  console.log(
    JSON.stringify({ app: appSlug, output: outputPath, width: 1024, height: 500 }, null, 2)
  )
}

main().catch((error) => {
  console.error(`Failed to write feature graphic: ${error.message}`)
  process.exit(1)
})
