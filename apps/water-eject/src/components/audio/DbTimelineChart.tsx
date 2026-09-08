import { useWindowDimensions, View } from 'react-native'
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polyline,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import {
  classifyMeterBand,
  MAX_ESTIMATED_DB,
  METER_BAND_THRESHOLDS,
  type MeterTimelinePoint,
} from '@/services/audio'
import { useIsRTL } from '@/services/rtl'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { getDbMeterBandColors } from './dbMeterBands'

interface DbTimelineChartProps {
  accessibilityLabel: string
  points: readonly MeterTimelinePoint[]
  maxPoints?: number
}

const CHART_HEIGHT = 184
const PLOT_TOP = 12
const PLOT_BOTTOM = CHART_HEIGHT - 12
const AXIS_INSET = 24
const OPPOSITE_INSET = 12
const Y_AXIS_TICKS = [0, 20, 40, 60, 80, 100, 120] as const

const NORMAL_BAND_START = METER_BAND_THRESHOLDS.normal / MAX_ESTIMATED_DB
const LOUD_BAND_START = METER_BAND_THRESHOLDS.loud / MAX_ESTIMATED_DB
const DANGER_BAND_START = METER_BAND_THRESHOLDS.danger / MAX_ESTIMATED_DB

export const DbTimelineChart = ({
  accessibilityLabel,
  points,
  maxPoints = 60,
}: DbTimelineChartProps) => {
  const { width } = useWindowDimensions()
  const isRTL = useIsRTL()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const chartWidth = Math.min(Math.max(width - 64, 220), 620)
  const plotLeft = isRTL ? OPPOSITE_INSET : AXIS_INSET
  const plotRight = chartWidth - (isRTL ? AXIS_INSET : OPPOSITE_INSET)
  const plotWidth = plotRight - plotLeft
  const plotHeight = PLOT_BOTTOM - PLOT_TOP
  const visiblePoints = points.slice(-maxPoints)
  const firstSecond = visiblePoints[0]?.second ?? 0
  const lastSecond = visiblePoints.at(-1)?.second ?? firstSecond
  const durationSeconds = Math.max(lastSecond - firstSecond, 1)
  const chartPoints = visiblePoints.map(({ second, estimatedDb }) => {
    const elapsedProgress = (second - firstSecond) / durationSeconds
    const x = isRTL
      ? plotRight - elapsedProgress * plotWidth
      : plotLeft + elapsedProgress * plotWidth
    const normalizedDb = Math.min(Math.max(estimatedDb, 0), MAX_ESTIMATED_DB)
    const y = PLOT_BOTTOM - (normalizedDb / MAX_ESTIMATED_DB) * plotHeight
    return { x, y }
  })
  const polyline = chartPoints.map(({ x, y }) => `${x},${y}`).join(' ')
  const areaPath =
    chartPoints.length > 1
      ? [
          `M ${chartPoints[0].x},${PLOT_BOTTOM}`,
          ...chartPoints.map(({ x, y }) => `L ${x},${y}`),
          `L ${chartPoints.at(-1)?.x ?? plotRight},${PLOT_BOTTOM}`,
          'Z',
        ].join(' ')
      : ''
  const bandColors = getDbMeterBandColors(theme.colors)

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={styles.container}>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient
            id="dbLevelGradient"
            x1={0}
            y1={PLOT_BOTTOM}
            x2={0}
            y2={PLOT_TOP}
            gradientUnits="userSpaceOnUse">
            <Stop offset={0} stopColor={bandColors.veryQuiet} />
            <Stop offset={NORMAL_BAND_START} stopColor={bandColors.veryQuiet} />
            <Stop offset={NORMAL_BAND_START} stopColor={bandColors.normal} />
            <Stop offset={LOUD_BAND_START} stopColor={bandColors.normal} />
            <Stop offset={LOUD_BAND_START} stopColor={bandColors.loud} />
            <Stop offset={DANGER_BAND_START} stopColor={bandColors.loud} />
            <Stop offset={DANGER_BAND_START} stopColor={bandColors.danger} />
            <Stop offset={1} stopColor={bandColors.danger} />
          </LinearGradient>
        </Defs>

        {Y_AXIS_TICKS.map((value) => {
          const y = PLOT_BOTTOM - (value / MAX_ESTIMATED_DB) * plotHeight
          const labelColor = bandColors[classifyMeterBand(value)]

          return (
            <G key={value}>
              <Line
                x1={plotLeft}
                x2={plotRight}
                y1={y}
                y2={y}
                stroke={theme.colors.border.subtle}
                strokeWidth={1}
              />
              <SvgText
                x={isRTL ? plotRight + 6 : plotLeft - 6}
                y={y + 4}
                fill={labelColor}
                fontFamily={theme.typography.fontFamily.medium}
                fontSize={theme.typography.sizes.xs}
                fontWeight={theme.typography.weights.medium}
                textAnchor={isRTL ? 'start' : 'end'}>
                {value}
              </SvgText>
            </G>
          )
        })}

        <Line
          x1={isRTL ? plotRight : plotLeft}
          x2={isRTL ? plotRight : plotLeft}
          y1={PLOT_TOP}
          y2={PLOT_BOTTOM}
          stroke={theme.colors.border.default}
          strokeWidth={1}
        />

        {visiblePoints.length > 1 ? (
          <>
            <Path d={areaPath} fill="url(#dbLevelGradient)" opacity={0.12} />
            <Polyline
              points={polyline}
              fill="none"
              stroke="url(#dbLevelGradient)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
      </Svg>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: t.spacing.xs,
    paddingVertical: t.spacing.sm,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.xl,
    backgroundColor: t.colors.background.subtle,
  },
}))
