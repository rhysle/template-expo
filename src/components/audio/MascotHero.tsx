import { Image } from 'expo-image'
import { useIsFocused } from 'expo-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

import { getMascotLayout, isMascotLayoutReady, type MascotLayout } from './mascot-layout'

const IMAGE_FRAME_SIZE = 208
const IMAGE_FRAME_COMPACT_SIZE = 156
const IMAGE_FRAME_PLAIN_SIZE = 336
const IMAGE_FRAME_PLAIN_COMPACT_SIZE = 244
const IMAGE_PULSE_SCALE = 0.025

interface MascotHeroProps {
  active?: boolean
  accentColor?: string
  compact?: boolean
  fillAvailableSpace?: boolean
  showWaves?: boolean
  style?: StyleProp<ViewStyle>
}

export const MascotHero = ({
  active = false,
  accentColor,
  compact = false,
  fillAvailableSpace = false,
  showWaves = true,
  style,
}: MascotHeroProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const reducedMotion = useReducedMotion()
  const pulse = useSharedValue(0)
  const containerRef = useRef<View>(null)
  const [fluidLayout, setFluidLayout] = useState<MascotLayout>()
  const resolvedAccent = accentColor ?? theme.colors.primary.main
  const useFluidLayout = fillAvailableSpace && !showWaves
  const isFocused = useIsFocused()
  const isImageFrameReady = isMascotLayoutReady(useFluidLayout, fluidLayout)

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    if (!useFluidLayout || !isFocused) return

    const nextLayout = getMascotLayout(nativeEvent.layout.width, nativeEvent.layout.height)
    setFluidLayout((currentLayout) =>
      currentLayout?.frameWidth === nextLayout.frameWidth &&
      currentLayout.frameHeight === nextLayout.frameHeight
        ? currentLayout
        : nextLayout
    )
  }

  useLayoutEffect(() => {
    if (!useFluidLayout) return
    if (!isFocused) return

    containerRef.current?.measure((_x, _y, width, height) => {
      const nextLayout = getMascotLayout(width, height)
      setFluidLayout((currentLayout) =>
        currentLayout?.frameWidth === nextLayout.frameWidth &&
        currentLayout.frameHeight === nextLayout.frameHeight
          ? currentLayout
          : nextLayout
      )
    })
  }, [isFocused, useFluidLayout])

  useEffect(() => {
    cancelAnimation(pulse)
    if (active && !reducedMotion) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 750, easing: Easing.in(Easing.quad) })
        ),
        -1
      )
    } else {
      pulse.value = withTiming(0, { duration: 180, reduceMotion: ReduceMotion.System })
    }

    return () => cancelAnimation(pulse)
  }, [active, pulse, reducedMotion])

  const imageFrameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * IMAGE_PULSE_SCALE }],
  }))
  const innerWaveStyle = useAnimatedStyle(() => ({
    opacity: 0.42 - pulse.value * 0.18,
    transform: [{ scale: 0.92 + pulse.value * 0.18 }],
  }))
  const outerWaveStyle = useAnimatedStyle(() => ({
    opacity: 0.24 - pulse.value * 0.16,
    transform: [{ scale: 0.84 + pulse.value * 0.3 }],
  }))

  return (
    <View
      ref={containerRef}
      onLayout={handleLayout}
      style={[
        styles.container,
        compact && styles.containerCompact,
        fillAvailableSpace && styles.containerFill,
        style,
      ]}>
      {showWaves ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.wave,
              compact && styles.waveCompact,
              { borderColor: withAlpha(resolvedAccent, 0.8) },
              outerWaveStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.wave,
              compact && styles.waveCompact,
              { borderColor: resolvedAccent },
              innerWaveStyle,
            ]}
          />
        </>
      ) : null}
      {isImageFrameReady ? (
        <View pointerEvents="box-none" style={useFluidLayout && styles.fluidImageFrameHost}>
          <Animated.View
            style={[
              styles.imageFrame,
              !showWaves && styles.imageFramePlain,
              compact && styles.imageFrameCompact,
              !showWaves && compact && styles.imageFramePlainCompact,
              fluidLayout && { width: fluidLayout.frameWidth, height: fluidLayout.frameHeight },
              imageFrameStyle,
            ]}>
            <Image
              accessibilityLabel={t('audioTools.common.mascot')}
              source={require('@/assets/images/mascot.png')}
              allowDownscaling={false}
              contentFit={fluidLayout ? 'fill' : 'cover'}
              transition={180}
              style={[
                styles.image,
                fluidLayout && {
                  position: 'absolute',
                  top: fluidLayout.imageTop,
                  left: fluidLayout.imageLeft,
                  width: fluidLayout.imageWidth,
                  height: fluidLayout.imageHeight,
                },
              ]}
            />
          </Animated.View>
        </View>
      ) : null}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerCompact: {
    width: 184,
    height: 184,
  },
  containerFill: {
    minHeight: 0,
    flex: 1,
    width: '100%',
    height: 'auto',
  },
  fluidImageFrameHost: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFrame: {
    width: IMAGE_FRAME_SIZE,
    height: IMAGE_FRAME_SIZE,
    overflow: 'hidden',
    borderCurve: 'continuous',
    borderRadius: t.borderRadius['4xl'],
  },
  imageFrameCompact: {
    width: IMAGE_FRAME_COMPACT_SIZE,
    height: IMAGE_FRAME_COMPACT_SIZE,
    borderRadius: t.borderRadius['3xl'],
  },
  imageFramePlain: {
    width: IMAGE_FRAME_PLAIN_SIZE,
    height: IMAGE_FRAME_PLAIN_SIZE,
  },
  imageFramePlainCompact: {
    width: IMAGE_FRAME_PLAIN_COMPACT_SIZE,
    height: IMAGE_FRAME_PLAIN_COMPACT_SIZE,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  wave: {
    position: 'absolute',
    width: 238,
    height: 238,
    borderRadius: t.borderRadius.full,
    borderWidth: 2,
  },
  waveCompact: {
    width: 178,
    height: 178,
  },
}))
