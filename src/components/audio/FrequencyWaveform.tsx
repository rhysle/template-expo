import { Canvas, Group, Path, useClock, usePathValue } from '@shopify/react-native-skia'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import { useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'

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
  const clock = useClock()
  const width = useSharedValue(0)
  const height = useSharedValue(0)
  const normalizedFrequency = useSharedValue(normalizeFrequency(frequencyHz))
  const isActive = useSharedValue(active && !reducedMotion ? 1 : 0)
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
    isActive.value = active && !reducedMotion ? 1 : 0
  }, [active, isActive, reducedMotion])

  const primaryPath = usePathValue((builder) => {
    'worklet'
    builder.reset()
    const canvasWidth = width.value
    const canvasHeight = height.value
    if (canvasWidth <= 0 || canvasHeight <= 0) return

    const centerY = canvasHeight / 2
    const cycles = 2.15 + normalizedFrequency.value * 1.7
    const phase = isActive.value ? clock.value / 560 : 0.35
    const amplitude = canvasHeight * 0.25
    const points = Math.max(Math.round(canvasWidth / 3), 64)

    for (let index = 0; index <= points; index += 1) {
      const progress = index / points
      const x = progress * canvasWidth
      const y = centerY + Math.sin(progress * Math.PI * 2 * cycles + phase) * amplitude
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
    const phase = isActive.value ? 1.4 - clock.value / 820 : 1.4
    const amplitude = canvasHeight * 0.16
    const points = Math.max(Math.round(canvasWidth / 3), 64)

    for (let index = 0; index <= points; index += 1) {
      const progress = index / points
      const x = progress * canvasWidth
      const y = centerY + Math.sin(progress * Math.PI * 2 * cycles + phase) * amplitude
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
    const phase = isActive.value ? 2.1 + clock.value / 470 : 2.1
    const amplitude = canvasHeight * 0.1
    const points = Math.max(Math.round(canvasWidth / 3), 64)

    for (let index = 0; index <= points; index += 1) {
      const progress = index / points
      const x = progress * canvasWidth
      const y = centerY + Math.sin(progress * Math.PI * 2 * cycles + phase) * amplitude
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
