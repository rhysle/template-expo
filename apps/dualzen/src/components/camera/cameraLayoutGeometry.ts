export const getLandscapeGuideFrame = (
  width: number,
  height: number,
  position: number,
  mirrored: boolean
) => {
  'worklet'
  const guideHeight = (width * 9) / 16
  return {
    height: guideHeight,
    top: Math.max(0, height - guideHeight) * (mirrored ? 1 - position : position),
  }
}
