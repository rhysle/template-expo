const MASCOT_SOURCE_SIZE = 1_024

const MASCOT_VISIBLE_BOUNDS = {
  x: 144,
  y: 208,
  width: 760,
  height: 592,
} as const

export interface MascotLayout {
  frameHeight: number
  frameWidth: number
  imageHeight: number
  imageLeft: number
  imageTop: number
  imageWidth: number
  scale: number
}

export const isMascotLayoutReady = (useFluidLayout: boolean, layout: MascotLayout | undefined) =>
  !useFluidLayout || layout !== undefined

export const getMascotLayout = (availableWidth: number, availableHeight: number): MascotLayout => {
  const safeWidth = Number.isFinite(availableWidth) ? Math.max(availableWidth, 0) : 0
  const safeHeight = Number.isFinite(availableHeight) ? Math.max(availableHeight, 0) : 0
  const scale = Math.min(
    safeWidth / MASCOT_VISIBLE_BOUNDS.width,
    safeHeight / MASCOT_VISIBLE_BOUNDS.height
  )

  return {
    frameHeight: MASCOT_VISIBLE_BOUNDS.height * scale,
    frameWidth: MASCOT_VISIBLE_BOUNDS.width * scale,
    imageHeight: MASCOT_SOURCE_SIZE * scale,
    imageLeft: -MASCOT_VISIBLE_BOUNDS.x * scale,
    imageTop: -MASCOT_VISIBLE_BOUNDS.y * scale,
    imageWidth: MASCOT_SOURCE_SIZE * scale,
    scale,
  }
}
