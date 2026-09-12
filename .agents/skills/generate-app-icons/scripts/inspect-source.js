#!/usr/bin/env node

const fs = require('node:fs')
const sharp = require('sharp')

const args = process.argv.slice(2)
const sourceIndex = args.indexOf('--source')
const sourcePath = sourceIndex === -1 ? null : args[sourceIndex + 1]

if (!sourcePath) {
  console.error('Usage: node inspect-source.js --source <image>')
  process.exit(1)
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Source file not found: ${sourcePath}`)
  process.exit(1)
}

const SAMPLE_SIZE = 64
const CORNER_SIZE = 8
const CENTER_START = 24
const CENTER_SIZE = 16

function meanAlpha(data, channels, left, top, width, height) {
  let total = 0
  let count = 0
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      total += data[(y * SAMPLE_SIZE + x) * channels + 3]
      count += 1
    }
  }
  return total / count
}

function alphaAt(data, channels, x, y) {
  return data[(y * SAMPLE_SIZE + x) * channels + 3]
}

async function main() {
  const image = sharp(sourcePath)
  const [metadata, stats, sampled] = await Promise.all([
    image.metadata(),
    image.clone().stats(),
    image
      .clone()
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ])

  const { data, info } = sampled
  const corners = [
    meanAlpha(data, info.channels, 0, 0, CORNER_SIZE, CORNER_SIZE),
    meanAlpha(data, info.channels, SAMPLE_SIZE - CORNER_SIZE, 0, CORNER_SIZE, CORNER_SIZE),
    meanAlpha(data, info.channels, 0, SAMPLE_SIZE - CORNER_SIZE, CORNER_SIZE, CORNER_SIZE),
    meanAlpha(
      data,
      info.channels,
      SAMPLE_SIZE - CORNER_SIZE,
      SAMPLE_SIZE - CORNER_SIZE,
      CORNER_SIZE,
      CORNER_SIZE
    ),
  ]
  const center = meanAlpha(
    data,
    info.channels,
    CENTER_START,
    CENTER_START,
    CENTER_SIZE,
    CENTER_SIZE
  )
  const cornerPixels = [
    alphaAt(data, info.channels, 0, 0),
    alphaAt(data, info.channels, SAMPLE_SIZE - 1, 0),
    alphaAt(data, info.channels, 0, SAMPLE_SIZE - 1),
    alphaAt(data, info.channels, SAMPLE_SIZE - 1, SAMPLE_SIZE - 1),
  ]
  const transparentCornerPixels = cornerPixels.filter((alpha) => alpha < 64).length

  console.log(
    JSON.stringify(
      {
        path: sourcePath,
        format: metadata.format || null,
        width: metadata.width || null,
        height: metadata.height || null,
        isSquare: Boolean(metadata.width && metadata.width === metadata.height),
        isOpaque: stats.isOpaque,
        likelyTransparentCornerMask: center > 245 && transparentCornerPixels >= 3,
        sampledCornerPixelAlpha: cornerPixels,
        sampledCornerAlpha: corners.map((alpha) => Math.round(alpha)),
        sampledCenterAlpha: Math.round(center),
        note: 'Opaque rounded boundaries still require visual inspection.',
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(`Failed to inspect source: ${error.message}`)
  process.exit(1)
})
