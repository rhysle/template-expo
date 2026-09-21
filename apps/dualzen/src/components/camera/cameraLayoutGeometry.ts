export const getLandscapeGuideFrame = (width: number, height: number, position: number) => {
  'worklet'
  const guideHeight = (width * 9) / 16
  return {
    height: guideHeight,
    top: Math.max(0, height - guideHeight) * position,
  }
}
