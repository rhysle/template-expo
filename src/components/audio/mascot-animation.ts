import type { AnimationObject, LottieViewProps } from 'lottie-react-native'

import { hexToRgb, mixHexColors } from '@/utils/color'

const MASCOT_LAYER_NAMES = [
  'Tail',
  'Eye',
  'Eye white',
  'Body',
  'Fin',
  'Belly 1',
  'Belly 2',
  'Belly 3',
  'Belly 4',
  'Belly 5',
  'Spout left',
  'Spout center',
  'Spout right',
] as const

type MascotLayerName = (typeof MASCOT_LAYER_NAMES)[number]
type MascotPalette = Record<MascotLayerName, string>

interface LottieColorProperty {
  a?: number
  k: number[]
  [key: string]: unknown
}

interface LottieShape {
  c?: LottieColorProperty
  it?: LottieShape[]
  ty?: string
  [key: string]: unknown
}

interface LottieLayer {
  nm?: string
  shapes?: LottieShape[]
  [key: string]: unknown
}

interface MascotAnimationObject extends Omit<AnimationObject, 'layers'> {
  layers: LottieLayer[]
}

const themedSourceCache = new WeakMap<object, Map<string, MascotAnimationObject>>()

export const createMascotPalette = (
  accent: string,
  surface: string,
  contrast: string
): MascotPalette => ({
  Tail: accent,
  Body: accent,
  Fin: accent,
  Eye: mixHexColors(accent, contrast, 0.38),
  'Eye white': surface,
  'Belly 1': mixHexColors(accent, surface, 0.38),
  'Belly 2': mixHexColors(accent, surface, 0.52),
  'Belly 3': mixHexColors(accent, surface, 0.64),
  'Belly 4': mixHexColors(accent, surface, 0.76),
  'Belly 5': mixHexColors(accent, surface, 0.88),
  'Spout left': mixHexColors(accent, surface, 0.28),
  'Spout center': mixHexColors(accent, surface, 0.18),
  'Spout right': mixHexColors(accent, surface, 0.28),
})

const toLottieColor = (hex: string) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return [...rgb.map((channel) => channel / 255), 1]
}

const recolorShapes = (shapes: LottieShape[], color: number[]): LottieShape[] =>
  shapes.map((shape) => {
    const nestedShapes = shape.it ? recolorShapes(shape.it, color) : undefined
    const isColorProperty =
      (shape.ty === 'fl' || shape.ty === 'st') && shape.c && Array.isArray(shape.c.k)

    return {
      ...shape,
      ...(nestedShapes ? { it: nestedShapes } : {}),
      ...(isColorProperty ? { c: { ...shape.c, k: color } } : {}),
    }
  })

const isMascotAnimationObject = (
  source: LottieViewProps['source']
): source is MascotAnimationObject =>
  typeof source === 'object' &&
  source !== null &&
  'layers' in source &&
  Array.isArray((source as { layers?: unknown }).layers)

export const createThemedMascotSource = (
  source: LottieViewProps['source'],
  palette: MascotPalette
): LottieViewProps['source'] => {
  if (!isMascotAnimationObject(source)) return source

  const cacheKey = MASCOT_LAYER_NAMES.map((name) => palette[name]).join('|')
  const sourceCache = themedSourceCache.get(source) ?? new Map<string, MascotAnimationObject>()
  const cachedSource = sourceCache.get(cacheKey)
  if (cachedSource) return cachedSource

  const themedSource: MascotAnimationObject = {
    ...source,
    layers: source.layers.map((layer) => {
      if (!MASCOT_LAYER_NAMES.includes(layer.nm as MascotLayerName)) return layer

      const color = toLottieColor(palette[layer.nm as MascotLayerName])
      if (!color || !layer.shapes) return layer

      return { ...layer, shapes: recolorShapes(layer.shapes, color) }
    }),
  }

  sourceCache.set(cacheKey, themedSource)
  themedSourceCache.set(source, sourceCache)
  return themedSource
}
