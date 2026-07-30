export const DB_METER_INDICATOR_SIZE = 24

// This project enables React Native's automatic left/right swapping. Keeping one left anchor
// therefore places the indicator at the logical start edge: physical left in LTR, right in RTL.
export const DB_METER_INDICATOR_ANCHOR = { left: 0 } as const

const DB_METER_INDICATOR_EDGE_OFFSET = 10

export const getDbMeterGradientDirection = (isRTL: boolean) => ({
  start: { x: isRTL ? 1 : 0, y: 0.5 },
  end: { x: isRTL ? 0 : 1, y: 0.5 },
})

export const getDbMeterIndicatorTranslation = (
  progress: number,
  trackWidth: number,
  isRTL: boolean
) => {
  'worklet'
  const ltrTranslation = progress * trackWidth - DB_METER_INDICATOR_EDGE_OFFSET

  return isRTL ? -ltrTranslation : ltrTranslation
}
