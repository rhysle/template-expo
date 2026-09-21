import type { PixelSize } from '@/services/camera/types'

export const getLandscapeGuideFrame = (
  width: number,
  height: number,
  position: number,
  source?: PixelSize
) => {
  'worklet'
  if (!source || source.width <= 0 || source.height <= 0) {
    const guideHeight = (width * 9) / 16
    return {
      height: guideHeight,
      top: Math.max(0, height - guideHeight) * position,
    }
  }
  const portraitWidth = Math.min(source.width, (source.height * 9) / 16)
  const portraitHeight = Math.min(source.height, (source.width * 16) / 9)
  const landscapeHeight = Math.min(source.height, (source.width * 9) / 16)
  const scale = Math.min(width / portraitWidth, height / portraitHeight)
  const guideHeight = landscapeHeight * scale
  return {
    height: guideHeight,
    top: Math.max(0, height - guideHeight) * position,
  }
}
