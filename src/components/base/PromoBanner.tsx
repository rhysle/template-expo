import { Canvas, Group, LinearGradient, Path, Rect, Skia, vec } from '@shopify/react-native-skia'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useIsRTL } from '@/services/rtl'
import { createThemedStyles, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

import { Pressable } from './Pressable'
import { Text } from './Text'

export interface PromoBannerProps {
  icon: ReactNode
  title: string
  subtitle: string
  style?: StyleProp<ViewStyle>
}

const STRIPE_WIDTH = 40
const STRIPE_GAP = 0
const STRIPE_LEAN_DEGREES = 22
const STRIPE_MIDDLE_COLOR = 'rgba(255,255,255,0.2)'
const STRIPE_OUTER_COLOR = 'rgba(255,255,255,0.1)'

export const PromoBanner = ({ icon, title, subtitle, style }: PromoBannerProps) => {
  const router = useRouter()
  const styles = useThemedStyles(createStyles)
  const isRTL = useIsRTL()

  // Canvas dimensions - set from onLayout
  const canvasWidth = useSharedValue(0)
  const canvasHeight = useSharedValue(0)

  // Shimmer - 3 grouped diagonal stripes (/// direction) sweeping left to right
  // Outer stripes are softer; middle stripe is deeper for a layered sheen
  const shimmerOffset = useSharedValue(-200)
  // Pre-allocate paths and mutate in-place to avoid returning SkPath JSI HostObjects
  // from useDerivedValue - Reanimated's valueSetter misidentifies them as animation objects
  // (via the .onFrame check), crashing with "onStart is not a function".
  // useAnimatedReaction is used instead of useDerivedValue because its callback only ever
  // runs on the UI/worklet runtime (no initial JS-thread run), so _value writes are safe.
  // Pattern mirrors Skia's own usePathValue / notifyChange approach.
  const shimmerOuterPath = useSharedValue(Skia.Path.Make())
  useAnimatedReaction(
    () => ({ offset: shimmerOffset.value, h: canvasHeight.value }),
    ({ offset, h }) => {
      const path = shimmerOuterPath.value
      path.reset()
      if (h > 0) {
        const lean = h * Math.tan((STRIPE_LEAN_DEGREES * Math.PI) / 180)
        for (const i of [0, 2]) {
          const x = offset + i * (STRIPE_WIDTH + STRIPE_GAP)
          // /// direction: top edge shifted right by lean, bottom edge stays
          path.moveTo(x + lean, 0)
          path.lineTo(x + lean + STRIPE_WIDTH, 0)
          path.lineTo(x + STRIPE_WIDTH, h)
          path.lineTo(x, h)
          path.close()
        }
      }
      // Notify Skia's canvas mapper - write _value directly to trigger listeners
      ;(shimmerOuterPath as unknown as { _value: typeof shimmerOuterPath.value })._value = path
    }
  )
  const shimmerMiddlePath = useSharedValue(Skia.Path.Make())
  useAnimatedReaction(
    () => ({ offset: shimmerOffset.value, h: canvasHeight.value }),
    ({ offset, h }) => {
      const path = shimmerMiddlePath.value
      path.reset()
      if (h > 0) {
        const lean = h * Math.tan((STRIPE_LEAN_DEGREES * Math.PI) / 180)
        const x = offset + 1 * (STRIPE_WIDTH + STRIPE_GAP)
        path.moveTo(x + lean, 0)
        path.lineTo(x + lean + STRIPE_WIDTH, 0)
        path.lineTo(x + STRIPE_WIDTH, h)
        path.lineTo(x, h)
        path.close()
      }
      // Notify Skia's canvas mapper - write _value directly to trigger listeners
      ;(shimmerMiddlePath as unknown as { _value: typeof shimmerMiddlePath.value })._value = path
    }
  )

  // Ripple - horizontal spread from press point, fades as it expands
  const rippleCX = useSharedValue(0)
  const rippleRadius = useSharedValue(0)
  const rippleOpacity = useSharedValue(0)
  const rippleStart = useDerivedValue(() =>
    vec(rippleCX.value - rippleRadius.value, canvasHeight.value / 2)
  )
  const rippleEnd = useDerivedValue(() =>
    vec(rippleCX.value + rippleRadius.value, canvasHeight.value / 2)
  )
  const rippleColors: [string, string, string] = [
    'transparent',
    'rgba(255,255,255,0.5)',
    'transparent',
  ]

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    canvasWidth.value = width
    canvasHeight.value = height
    // Start shimmer here - canvasWidth is a SharedValue and won't trigger useEffect
    cancelAnimation(shimmerOffset)
    shimmerOffset.value = isRTL ? width + 200 : -200
    shimmerOffset.value = withRepeat(
      withTiming(isRTL ? -200 : width + 60, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    )
  }

  const handlePressIn = (e: GestureResponderEvent) => {
    // Ripple: reset then animate - setting .value = 0 cancels any in-flight animation
    rippleCX.value = e.nativeEvent.locationX
    rippleRadius.value = 0
    rippleOpacity.value = 0.5
    rippleRadius.value = withTiming(800, { duration: 550, easing: Easing.out(Easing.quad) })
    rippleOpacity.value = withTiming(0, { duration: 550 })
  }

  useEffect(() => {
    return () => cancelAnimation(shimmerOffset)
  }, [shimmerOffset])

  return (
    <Pressable
      activeOpacity={1}
      onPress={() => router.push('/paywall')}
      onPressIn={handlePressIn}
      haptic
      style={[styles.container, style]}>
      <View>
        <View style={styles.inner} onLayout={handleLayout}>
          <View style={styles.iconContainer}>{icon}</View>
          <View style={styles.content}>
            <Text variant="subtitle" weight="bold" style={styles.title}>
              {title}
            </Text>
            <Text variant="body" style={styles.subtitle}>
              {subtitle}
            </Text>
          </View>
        </View>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Layer 1: Shimmer stripes - outer soft, middle deep */}
          <Path path={shimmerOuterPath} color={STRIPE_OUTER_COLOR} />
          <Path path={shimmerMiddlePath} color={STRIPE_MIDDLE_COLOR} />
          {/* Layer 2: Press ripple */}
          <Group opacity={rippleOpacity}>
            <Rect x={0} y={0} width={canvasWidth} height={canvasHeight}>
              <LinearGradient
                start={rippleStart}
                end={rippleEnd}
                colors={rippleColors}
                positions={[0, 0.5, 1]}
              />
            </Rect>
          </Group>
        </Canvas>
      </View>
    </Pressable>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    borderRadius: t.borderRadius.xl,
    overflow: 'hidden',
    // Fills the gap between the scaled inner content and the clip boundary on press
    backgroundColor: t.colors.primary.main,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.primary.main,
    paddingVertical: t.spacing.lg,
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.md,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: t.borderRadius.lg,
    backgroundColor: withAlpha(t.colors.background.base, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: t.spacing.xs,
  },
  title: {
    color: t.colors.text.inverse,
  },
  subtitle: {
    color: t.colors.text.inverseMuted,
  },
}))
