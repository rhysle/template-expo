import { Canvas, Group, Path, useClock, usePathValue } from '@shopify/react-native-skia'
import { useEffect } from 'react'
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import { useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'

import { normalizeFrequency } from '@/services/audio'
import { createThemedStyles, useThemedStyles } from '@/theme'

interface FrequencyWaveformProps {
  frequencyHz: number
  active: boolean
  color: string
  accessibilityLabel: string
  style?: StyleProp<ViewStyle>
}

export const FrequencyWaveform = ({
  frequencyHz,
  active,
  color,
  accessibilityLabel,
  style,
}: FrequencyWaveformProps) => {
  const styles = useThemedStyles(createStyles)
  const reducedMotion = useReducedMotion()
  const clock = useClock()
  const width = useSharedValue(0)
  const height = useSharedValue(0)
  const normalizedFrequency = useSharedValue(normalizeFrequency(frequencyHz))
  const isActive = useSharedValue(active && !reducedMotion ? 1 : 0)

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
    backgroundColor: t.colors.primary.soft,
  },
  canvas: {
    flex: 1,
  },
}))
