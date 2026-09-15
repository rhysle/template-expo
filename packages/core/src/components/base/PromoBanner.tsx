import { useIsRTL } from '@shared/core/services/rtl'
import { createThemedStyles, useTheme, useThemedStyles } from '@shared/core/theme'
import { withAlpha } from '@shared/core/utils/color'
import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Polygon } from 'react-native-svg'

import { Pressable } from './Pressable'
import { Text } from './Text'

export interface PromoBannerProps {
  icon: ReactNode
  title: string
  subtitle: string
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

const STRIPE_WIDTH = 40
const STRIPE_COUNT = 3
const STRIPE_LEAN_DEGREES = 22
const STRIPE_CONTENT_WIDTH = STRIPE_WIDTH * STRIPE_COUNT
const SHIMMER_EDGE_PADDING = 1
const RIPPLE_RADIUS = 800
const RIPPLE_DIAMETER = RIPPLE_RADIUS * 2
const RIPPLE_LOCATIONS = [0, 0.5, 1] as const
const GRADIENT_START = { x: 0, y: 0.5 } as const
const GRADIENT_END = { x: 1, y: 0.5 } as const

interface BannerSize {
  width: number
  height: number
}

const getStripePoints = (index: number, lean: number, height: number): string => {
  const startX = index * STRIPE_WIDTH
  const endX = startX + STRIPE_WIDTH
  return `${startX + lean},0 ${endX + lean},0 ${endX},${height} ${startX},${height}`
}

export const PromoBanner = ({ icon, title, subtitle, onPress, style }: PromoBannerProps) => {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const isRTL = useIsRTL()
  const reducedMotion = useReducedMotion()
  const [bannerSize, setBannerSize] = useState<BannerSize>({ width: 0, height: 0 })

  const stripeLean = bannerSize.height * Math.tan((STRIPE_LEAN_DEGREES * Math.PI) / 180)
  const shimmerWidth = STRIPE_CONTENT_WIDTH + stripeLean
  const shimmerTravelDistance = (bannerSize.width + shimmerWidth) / 2 + SHIMMER_EDGE_PADDING

  // Shimmer - 3 grouped diagonal stripes (/// direction) sweeping left to right
  // Outer stripes are softer; middle stripe is deeper for a layered sheen
  const shimmerOffset = useSharedValue(0)
  const shimmerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerOffset.value }],
  }))

  // Ripple - horizontal spread from press point, fades as it expands
  const rippleCX = useSharedValue(0)
  const rippleScale = useSharedValue(0)
  const rippleOpacity = useSharedValue(0)
  const ripplePositionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ translateX: rippleCX.value - bannerSize.width / 2 }],
  }))
  const rippleScaleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: rippleScale.value }],
  }))
  const rippleColors = [
    withAlpha(colors.text.inverse, 0),
    withAlpha(colors.text.inverse, 0.5),
    withAlpha(colors.text.inverse, 0),
  ] as const
  const shimmerOuterColor = withAlpha(colors.text.inverse, 0.1)
  const shimmerMiddleColor = withAlpha(colors.text.inverse, 0.2)

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setBannerSize((currentSize) => {
      if (currentSize.width === width && currentSize.height === height) return currentSize
      return { width, height }
    })
  }

  useEffect(() => {
    cancelAnimation(shimmerOffset)
    if (bannerSize.width <= 0 || bannerSize.height <= 0) return

    shimmerOffset.value = isRTL ? shimmerTravelDistance : -shimmerTravelDistance
    if (reducedMotion) return () => cancelAnimation(shimmerOffset)

    shimmerOffset.value = withRepeat(
      withTiming(isRTL ? -shimmerTravelDistance : shimmerTravelDistance, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.System
    )

    return () => cancelAnimation(shimmerOffset)
  }, [
    bannerSize.height,
    bannerSize.width,
    isRTL,
    reducedMotion,
    shimmerOffset,
    shimmerTravelDistance,
  ])

  const handlePressIn = (e: GestureResponderEvent) => {
    rippleCX.value = e.nativeEvent.locationX
    rippleScale.value = 0
    if (reducedMotion) {
      rippleOpacity.value = 0
      return
    }

    rippleOpacity.value = 0.5
    rippleScale.value = withTiming(1, {
      duration: 550,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    })
    rippleOpacity.value = withTiming(0, {
      duration: 550,
      reduceMotion: ReduceMotion.System,
    })
  }

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} haptic style={[styles.container, style]}>
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
        <View style={styles.animationOverlay} pointerEvents="none">
          <Animated.View style={[styles.shimmerTrack, shimmerAnimatedStyle]}>
            {bannerSize.height > 0 ? (
              <Svg width={shimmerWidth} height={bannerSize.height}>
                <Polygon
                  points={getStripePoints(0, stripeLean, bannerSize.height)}
                  fill={shimmerOuterColor}
                />
                <Polygon
                  points={getStripePoints(1, stripeLean, bannerSize.height)}
                  fill={shimmerMiddleColor}
                />
                <Polygon
                  points={getStripePoints(2, stripeLean, bannerSize.height)}
                  fill={shimmerOuterColor}
                />
              </Svg>
            ) : null}
          </Animated.View>
          <Animated.View style={[styles.ripplePosition, ripplePositionAnimatedStyle]}>
            <Animated.View style={[styles.ripple, rippleScaleAnimatedStyle]}>
              <LinearGradient
                colors={rippleColors}
                locations={RIPPLE_LOCATIONS}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={styles.gradient}
              />
            </Animated.View>
          </Animated.View>
        </View>
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
    borderCurve: 'continuous',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.primary.main,
    paddingVertical: t.spacing.lg,
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.md,
  },
  animationOverlay: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  shimmerTrack: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  ripplePosition: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  ripple: {
    width: RIPPLE_DIAMETER,
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFill,
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
