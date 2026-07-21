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
    const cycles = 2 + normalizedFrequency.value * 12
    const amplitude = canvasHeight * (0.2 + (1 - normalizedFrequency.value) * 0.16)
    const phase = isActive.value ? clock.value / 340 : 0
    const points = Math.max(Math.round(canvasWidth / 4), 48)

    for (let index = 0; index <= points; index += 1) {
      const progress = index / points
      const edgeFade = Math.sin(progress * Math.PI)
      const harmonic = Math.sin(progress * Math.PI * cycles * 2 + phase)
      const detail = Math.sin(progress * Math.PI * cycles * 4 - phase * 0.65) * 0.22
      const y = centerY + (harmonic + detail) * amplitude * edgeFade
      const x = progress * canvasWidth
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
        <Path path={path} color={color} style="stroke" strokeWidth={4} strokeCap="round" />
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
