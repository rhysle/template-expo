import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { type StyleProp, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, type CircleProps, G } from 'react-native-svg'

import { useTheme } from '@/theme'

import { type ComponentTone, getComponentToneColor } from './ComponentTone'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const ANIMATION_DURATION_MS = 250

export interface ProgressRingProps extends Omit<ViewProps, 'children' | 'style'> {
  value: number
  maximumValue?: number
  size?: number
  strokeWidth?: number
  tone?: ComponentTone
  animated?: boolean
  children?: ReactNode
  accessibilityValueText?: string
  style?: StyleProp<ViewStyle>
}

const normalizeProgress = (value: number, maximumValue: number) => {
  const safeMaximum = Number.isFinite(maximumValue) && maximumValue > 0 ? maximumValue : 1
  const finiteValue = Number.isFinite(value) ? value : 0
  const safeValue = Math.min(Math.max(finiteValue, 0), safeMaximum)

  return {
    maximumValue: safeMaximum,
    progress: safeValue / safeMaximum,
    value: safeValue,
  }
}

export const ProgressRing = ({
  value,
  maximumValue = 100,
  size = 120,
  strokeWidth = 10,
  tone = 'accent',
  animated = true,
  children,
  accessibilityLabel,
  accessibilityValueText,
  style,
  ...props
}: ProgressRingProps) => {
  const { colors } = useTheme()
  const safeSize = Number.isFinite(size) ? Math.max(size, 24) : 120
  const safeStrokeWidth = Number.isFinite(strokeWidth)
    ? Math.min(Math.max(strokeWidth, 1), safeSize / 2)
    : 10
  const radius = (safeSize - safeStrokeWidth) / 2
  const center = safeSize / 2
  const circumference = 2 * Math.PI * radius
  const normalized = normalizeProgress(value, maximumValue)
  const animatedProgress = useSharedValue(normalized.progress)
  const progressColor = getComponentToneColor(colors, tone)

  useEffect(() => {
    animatedProgress.value = animated
      ? withTiming(normalized.progress, {
          duration: ANIMATION_DURATION_MS,
          reduceMotion: ReduceMotion.System,
        })
      : normalized.progress

    return () => cancelAnimation(animatedProgress)
  }, [animated, animatedProgress, normalized.progress])

  const animatedProps = useAnimatedProps<CircleProps>(
    () => ({
      strokeDashoffset: circumference * (1 - animatedProgress.value),
    }),
    [circumference]
  )

  return (
    <View style={[{ width: safeSize, height: safeSize }, style]} {...props}>
      <Svg
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: normalized.maximumValue,
          now: normalized.value,
          text: accessibilityValueText,
        }}
        width={safeSize}
        height={safeSize}
        viewBox={`0 0 ${safeSize} ${safeSize}`}
        pointerEvents="none">
        <G rotation={-90} originX={center} originY={center}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.border.subtle}
            strokeWidth={safeStrokeWidth}
          />
          <AnimatedCircle
            animatedProps={animatedProps}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={progressColor}
            strokeDasharray={[circumference, circumference]}
            strokeLinecap="round"
            strokeWidth={safeStrokeWidth}
          />
        </G>
      </Svg>

      {children ? (
        <View pointerEvents="box-none" style={styles.content}>
          {children}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
