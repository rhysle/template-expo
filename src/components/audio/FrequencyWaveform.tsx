import { Canvas, Group, Path, usePathValue } from '@shopify/react-native-skia'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import {
  Easing,
  ReduceMotion,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { normalizeFrequency } from '@/services/audio'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

interface FrequencyWaveformProps {
  frequencyHz: number
  active: boolean
  color: string
  accessibilityLabel: string
  /** Controls how strongly the waves are softened behind an overlaid readout. */
  centerFadeIntensity?: number
  style?: StyleProp<ViewStyle>
}

export const FrequencyWaveform = ({
  frequencyHz,
  active,
  color,
  accessibilityLabel,
  centerFadeIntensity = 0.3,
  style,
}: FrequencyWaveformProps) => {
  const { appearance, colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const reducedMotion = useReducedMotion()
  const width = useSharedValue(0)
  const height = useSharedValue(0)
  const normalizedFrequency = useSharedValue(normalizeFrequency(frequencyHz))
  const motion = useSharedValue(active && !reducedMotion ? 1 : 0)
  const phase = useSharedValue(0)
  const resolvedFadeIntensity = Math.min(Math.max(centerFadeIntensity, 0), 1)
  const centerVeilAlpha = 1 - (1 - resolvedFadeIntensity) ** 8
  const centerVeilColors = [
    withAlpha(colors.background.base, 0),
    withAlpha(colors.background.base, 0),
    withAlpha(colors.background.base, centerVeilAlpha),
    withAlpha(colors.background.base, centerVeilAlpha),
    withAlpha(colors.background.base, 0),
    withAlpha(colors.background.base, 0),
  ] as const

  useEffect(() => {
    normalizedFrequency.value = withTiming(normalizeFrequency(frequencyHz), { duration: 180 })
  }, [frequencyHz, normalizedFrequency])

  useEffect(() => {
    const shouldMove = active && !reducedMotion
    motion.value = withTiming(shouldMove ? 1 : 0, {
      duration: shouldMove ? 320 : 420,
      easing: shouldMove ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      reduceMotion: ReduceMotion.System,
    })
  }, [active, motion, reducedMotion])

  useFrameCallback(({ timeSincePreviousFrame }) => {
    'worklet'
    if (timeSincePreviousFrame === null || motion.value <= 0) return

    // Cap catch-up after a delayed frame so the waveform never jumps forward.
    phase.value += Math.min(timeSincePreviousFrame, 64) * motion.value
  })

  const primaryPath = usePathValue((builder) => {
    'worklet'
    builder.reset()
    const canvasWidth = width.value
    const canvasHeight = height.value
    if (canvasWidth <= 0 || canvasHeight <= 0) return

    const centerY = canvasHeight / 2
    const cycles = 2.15 + normalizedFrequency.value * 1.7
    const wavePhase = 0.35 + phase.value / 560
    const amplitude = canvasHeight * 0.25
    const points = Math.max(Math.round(canvasWidth / 3), 64)

    for (let index = 0; index <= points; index += 1) {
      const progress = index / points
      const x = progress * canvasWidth
      const y = centerY + Math.sin(progress * Math.PI * 2 * cycles + wavePhase) * amplitude
      if (index === 0) builder.moveTo(x, y)
      else builder.lineTo(x, y)
    }
  })

  const secondaryPath = usePathValue((builder) => {
    'worklet'
    builder.reset()
    const canvasWidth = width.value
    const canvasHeight = height.value
    if (canvasWidth <= 0 || canvasHeight <= 0) return

    const centerY = canvasHeight / 2
    const cycles = 3.1 + normalizedFrequency.value * 2.5
    const wavePhase = 1.4 - phase.value / 820
    const amplitude = canvasHeight * 0.16
    const points = Math.max(Math.round(canvasWidth / 3), 64)

    for (let index = 0; index <= points; index += 1) {
      const progress = index / points
      const x = progress * canvasWidth
      const y = centerY + Math.sin(progress * Math.PI * 2 * cycles + wavePhase) * amplitude
      if (index === 0) builder.moveTo(x, y)
      else builder.lineTo(x, y)
    }
  })

  const detailPath = usePathValue((builder) => {
    'worklet'
    builder.reset()
    const canvasWidth = width.value
    const canvasHeight = height.value
    if (canvasWidth <= 0 || canvasHeight <= 0) return

    const centerY = canvasHeight / 2
    const cycles = 4.3 + normalizedFrequency.value * 3
    const wavePhase = 2.1 + phase.value / 470
    const amplitude = canvasHeight * 0.1
    const points = Math.max(Math.round(canvasWidth / 3), 64)

    for (let index = 0; index <= points; index += 1) {
      const progress = index / points
      const x = progress * canvasWidth
      const y = centerY + Math.sin(progress * Math.PI * 2 * cycles + wavePhase) * amplitude
      if (index === 0) builder.moveTo(x, y)
      else builder.lineTo(x, y)
    }
  })

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    width.value = nativeEvent.layout.width
    height.value = nativeEvent.layout.height
  }

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      onLayout={handleLayout}
      style={[styles.container, style]}>
      <Canvas pointerEvents="none" style={styles.canvas}>
        <Group opacity={0.2}>
          <Path
            path={detailPath}
            color={color}
            style="stroke"
            strokeWidth={1.25}
            strokeCap="round"
          />
        </Group>
        <Group opacity={0.5}>
          <Path
            path={secondaryPath}
            color={color}
            style="stroke"
            strokeWidth={1.25}
            strokeCap="round"
          />
        </Group>
        <Path path={primaryPath} color={color} style="stroke" strokeWidth={3} strokeCap="round" />
      </Canvas>
      {resolvedFadeIntensity > 0 ? (
        <>
          <BlurView
            pointerEvents="none"
            intensity={resolvedFadeIntensity * 35}
            tint={appearance}
            style={[styles.centerBlur, { opacity: resolvedFadeIntensity * 0.6 }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={centerVeilColors}
            locations={[0, 0.26, 0.42, 0.58, 0.74, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.centerVeil}
          />
        </>
      ) : null}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    width: '100%',
    height: 92,
    overflow: 'hidden',
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.xl,
  },
  canvas: {
    flex: 1,
  },
  centerBlur: {
    position: 'absolute',
    top: 0,
    right: '36%',
    bottom: 0,
    left: '36%',
  },
  centerVeil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
}))
