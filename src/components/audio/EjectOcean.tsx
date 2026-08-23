import {
  Canvas,
  LinearGradient as SkiaLinearGradient,
  Path,
  usePathValue,
  vec,
} from '@shopify/react-native-skia'
import { LinearGradient } from 'expo-linear-gradient'
import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  type SharedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

const ACTIVE_PHASE_SPEED = 0.0055
const TURBO_PHASE_SPEED = 0.012
const IDLE_PHASE_SPEED = 0.0012
const SPEED_TRANSITION_DURATION = 360
const MAX_FRAME_DELTA = 64
const WAVE_BASELINE = 24
const PRIMARY_WAVE_AMPLITUDE = 9
const SECONDARY_WAVE_AMPLITUDE = 7
const SURFACE_TINT_DEPTH = 86
const WAVE_SAMPLE_STEP = 10
const PRIMARY_WAVELENGTH = 116
const SECONDARY_WAVELENGTH = 168
const DEGREES_TO_RADIANS = Math.PI / 180

export const EJECT_OCEAN_SURFACE_OFFSET = WAVE_BASELINE

interface EjectOceanProps {
  active: boolean
  turbo?: boolean
  style?: StyleProp<ViewStyle>
  tiltDegrees?: SharedValue<number>
}

export const EjectOcean = ({ active, turbo = false, style, tiltDegrees }: EjectOceanProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const isFocused = useIsFocused()
  const reducedMotion = useReducedMotion()
  const canvasWidth = useSharedValue(0)
  const canvasHeight = useSharedValue(0)
  const phase = useSharedValue(0)
  const staticTiltDegrees = useSharedValue(0)
  const sceneTiltDegrees = tiltDegrees ?? staticTiltDegrees
  const speed = useSharedValue(
    isFocused && !reducedMotion
      ? active
        ? turbo
          ? TURBO_PHASE_SPEED
          : ACTIVE_PHASE_SPEED
        : IDLE_PHASE_SPEED
      : 0
  )

  useEffect(() => {
    cancelAnimation(speed)
    const targetSpeed =
      isFocused && !reducedMotion
        ? active
          ? turbo
            ? TURBO_PHASE_SPEED
            : ACTIVE_PHASE_SPEED
          : IDLE_PHASE_SPEED
        : 0

    speed.value = withTiming(targetSpeed, {
      duration: SPEED_TRANSITION_DURATION,
      easing: Easing.inOut(Easing.quad),
      reduceMotion: ReduceMotion.System,
    })

    return () => cancelAnimation(speed)
  }, [active, isFocused, reducedMotion, speed, turbo])

  useFrameCallback(({ timeSincePreviousFrame }) => {
    'worklet'
    if (timeSincePreviousFrame === null || speed.value <= 0) return

    phase.value -= Math.min(timeSincePreviousFrame, MAX_FRAME_DELTA) * speed.value
  })

  const secondaryWavePath = usePathValue((builder) => {
    'worklet'
    builder.reset()
    const width = canvasWidth.value
    const height = canvasHeight.value
    if (width <= 0 || height <= 0) return
    const surfaceBottom = Math.min(height, WAVE_BASELINE + SURFACE_TINT_DEPTH)
    const tiltSlope = Math.tan(sceneTiltDegrees.value * DEGREES_TO_RADIANS)

    const wavePhase = phase.value * 0.72 + 1.25
    const getY = (x: number) =>
      WAVE_BASELINE +
      SECONDARY_WAVE_AMPLITUDE * Math.sin((x / SECONDARY_WAVELENGTH) * Math.PI * 2 + wavePhase) +
      (x - width / 2) * tiltSlope

    builder.moveTo(0, getY(0))
    for (let x = WAVE_SAMPLE_STEP; x < width; x += WAVE_SAMPLE_STEP) {
      builder.lineTo(x, getY(x))
    }
    builder.lineTo(width, getY(width))
    builder.lineTo(width, surfaceBottom)
    builder.lineTo(0, surfaceBottom)
    builder.close()
  })

  const primaryWavePath = usePathValue((builder) => {
    'worklet'
    builder.reset()
    const width = canvasWidth.value
    const height = canvasHeight.value
    if (width <= 0 || height <= 0) return
    const surfaceBottom = Math.min(height, WAVE_BASELINE + SURFACE_TINT_DEPTH)
    const tiltSlope = Math.tan(sceneTiltDegrees.value * DEGREES_TO_RADIANS)

    const wavePhase = phase.value
    const getY = (x: number) =>
      WAVE_BASELINE +
      PRIMARY_WAVE_AMPLITUDE * Math.sin((x / PRIMARY_WAVELENGTH) * Math.PI * 2 + wavePhase) +
      (x - width / 2) * tiltSlope

    builder.moveTo(0, getY(0))
    for (let x = WAVE_SAMPLE_STEP; x < width; x += WAVE_SAMPLE_STEP) {
      builder.lineTo(x, getY(x))
    }
    builder.lineTo(width, getY(width))
    builder.lineTo(width, surfaceBottom)
    builder.lineTo(0, surfaceBottom)
    builder.close()
  })

  const foamPath = usePathValue((builder) => {
    'worklet'
    builder.reset()
    const width = canvasWidth.value
    if (width <= 0) return

    const wavePhase = phase.value
    const tiltSlope = Math.tan(sceneTiltDegrees.value * DEGREES_TO_RADIANS)
    const getY = (x: number) =>
      WAVE_BASELINE +
      PRIMARY_WAVE_AMPLITUDE * Math.sin((x / PRIMARY_WAVELENGTH) * Math.PI * 2 + wavePhase) +
      (x - width / 2) * tiltSlope

    builder.moveTo(0, getY(0))
    for (let x = WAVE_SAMPLE_STEP; x < width; x += WAVE_SAMPLE_STEP) {
      builder.lineTo(x, getY(x))
    }
    builder.lineTo(width, getY(width))
  })

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    canvasWidth.value = nativeEvent.layout.width
    canvasHeight.value = nativeEvent.layout.height
  }

  const depthColors = [
    withAlpha(colors.primary.main, 0.1),
    withAlpha(colors.primary.main, 0.045),
    withAlpha(colors.primary.main, 0),
  ] as const

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleLayout}
      pointerEvents="none"
      style={[styles.container, style]}>
      <LinearGradient
        colors={depthColors}
        locations={[0, 0.56, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.depthGradient, { top: WAVE_BASELINE + PRIMARY_WAVE_AMPLITUDE }]}
      />
      <Canvas pointerEvents="none" style={styles.canvas}>
        <Path path={secondaryWavePath}>
          <SkiaLinearGradient
            colors={[withAlpha(colors.primary.main, 0.08), withAlpha(colors.primary.main, 0)]}
            start={vec(0, WAVE_BASELINE)}
            end={vec(0, WAVE_BASELINE + SURFACE_TINT_DEPTH)}
          />
        </Path>
        <Path path={primaryWavePath}>
          <SkiaLinearGradient
            colors={[withAlpha(colors.primary.main, 0.06), withAlpha(colors.primary.main, 0)]}
            start={vec(0, WAVE_BASELINE)}
            end={vec(0, WAVE_BASELINE + SURFACE_TINT_DEPTH)}
          />
        </Path>
        <Path
          path={foamPath}
          color={withAlpha(colors.text.inverse, 0.52)}
          style="stroke"
          strokeWidth={1.5}
          strokeCap="round"
        />
      </Canvas>
    </View>
  )
}

const createStyles = createThemedStyles(() => ({
  container: {
    position: 'absolute',
    overflow: 'hidden',
  },
  depthGradient: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
  },
  canvas: {
    position: 'absolute',
    inset: 0,
  },
}))
