import { Canvas, Path, useClock, usePathValue } from '@shopify/react-native-skia'
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

  const path = usePathValue((builder) => {
    'worklet'
    builder.reset()
    const canvasWidth = width.value
    const canvasHeight = height.value
    if (canvasWidth <= 0 || canvasHeight <= 0) return

    const centerY = canvasHeight / 2
    const barCount = Math.max(Math.round(canvasWidth / 5), 48)
    const pulseCount = 3 + Math.round(normalizedFrequency.value * 4)
    const activePhase = isActive.value ? clock.value / 220 : 0

    for (let index = 0; index <= barCount; index += 1) {
      const progress = index / barCount
      let envelope = 0

      for (let pulse = 0; pulse < pulseCount; pulse += 1) {
        const pulseCenter = (pulse + 0.75) / (pulseCount + 0.5)
        const distance = (progress - pulseCenter) * pulseCount * 3.2
        envelope = Math.max(envelope, Math.exp(-(distance * distance)))
      }

      const barTexture = 0.94 + Math.sin(index * 1.7) * 0.06
      const activeScale = isActive.value
        ? 0.92 + Math.sin(activePhase + progress * Math.PI * 4) * 0.08
        : 1
      const barHeight = 3 + envelope * canvasHeight * 0.72 * barTexture * activeScale
      const x = progress * canvasWidth

      builder.moveTo(x, centerY - barHeight / 2)
      builder.lineTo(x, centerY + barHeight / 2)
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
        <Path path={path} color={color} style="stroke" strokeWidth={2.5} strokeCap="round" />
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
