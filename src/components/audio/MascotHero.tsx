import { useIsFocused } from 'expo-router'
import LottieView, { type LottieViewProps } from 'lottie-react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type StyleProp, View, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
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

import { createMascotPalette, createThemedMascotSource } from './mascot-animation'

const IMAGE_FRAME_SIZE = 208
const IMAGE_FRAME_COMPACT_SIZE = 156
const IMAGE_FRAME_PLAIN_SIZE = 336
const IMAGE_FRAME_PLAIN_COMPACT_SIZE = 244
const IMAGE_PULSE_SCALE = 0.025
const COLOR_TRANSITION_DURATION = 260
const DEFAULT_ANIMATION_SOURCE = require('@/assets/animations/mascot/eject.json')

interface PaletteTransitionSources {
  current: LottieViewProps['source']
  outgoing?: LottieViewProps['source']
}

export interface MascotHeroProps {
  active?: boolean
  accentColor?: string
  animationSource?: LottieViewProps['source']
  contentScale?: number
  compact?: boolean
  effectSource?: LottieViewProps['source']
  fillAvailableSpace?: boolean
  showWaves?: boolean
  style?: StyleProp<ViewStyle>
}

export const MascotHero = ({
  active = false,
  accentColor,
  animationSource = DEFAULT_ANIMATION_SOURCE,
  contentScale = 1,
  compact = false,
  effectSource,
  fillAvailableSpace = false,
  showWaves = true,
  style,
}: MascotHeroProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const reducedMotion = useReducedMotion()
  const pulse = useSharedValue(0)
  const paletteTransition = useSharedValue(1)
  const animationRef = useRef<LottieView>(null)
  const resolvedAccent = accentColor ?? theme.colors.primary.main
  const useFluidLayout = fillAvailableSpace && !showWaves
  const isFocused = useIsFocused()
  const palette = createMascotPalette(
    resolvedAccent,
    theme.colors.background.surface,
    theme.colors.text.primary
  )
  const themedAnimationSource = createThemedMascotSource(animationSource, palette)
  const themedEffectSource = effectSource
    ? createThemedMascotSource(effectSource, palette)
    : undefined
  const currentSourceRef = useRef(themedAnimationSource)
  const [transitionSources, setTransitionSources] = useState<PaletteTransitionSources>(() => ({
    current: themedAnimationSource,
  }))

  useEffect(() => {
    const outgoingSource = currentSourceRef.current
    if (reducedMotion) {
      currentSourceRef.current = themedAnimationSource
      paletteTransition.value = 1
      setTransitionSources((currentSources) =>
        currentSources.current === themedAnimationSource && !currentSources.outgoing
          ? currentSources
          : { current: themedAnimationSource }
      )
      return
    }
    if (outgoingSource === themedAnimationSource) return

    currentSourceRef.current = themedAnimationSource

    setTransitionSources({ current: themedAnimationSource, outgoing: outgoingSource })
    paletteTransition.value = 0
    paletteTransition.value = withTiming(1, {
      duration: COLOR_TRANSITION_DURATION,
      easing: Easing.inOut(Easing.quad),
      reduceMotion: ReduceMotion.System,
    })

    const cleanupTimer = setTimeout(
      () => setTransitionSources({ current: themedAnimationSource }),
      COLOR_TRANSITION_DURATION
    )
    return () => clearTimeout(cleanupTimer)
  }, [paletteTransition, reducedMotion, themedAnimationSource])

  useEffect(() => {
    if (isFocused && !reducedMotion) animationRef.current?.play()
    else animationRef.current?.pause()
  }, [isFocused, reducedMotion])

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
  const currentPaletteStyle = useAnimatedStyle(() => ({ opacity: paletteTransition.value }))
  const outgoingPaletteStyle = useAnimatedStyle(() => ({
    opacity: 1 - paletteTransition.value,
  }))
  const contentScaleStyle = { transform: [{ scale: contentScale }] }

  return (
    <View
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
      <View pointerEvents="box-none" style={useFluidLayout && styles.fluidAnimationHost}>
        <Animated.View
          accessible
          accessibilityLabel={t('audioTools.common.mascot')}
          accessibilityRole="image"
          style={[
            styles.animationFrame,
            !showWaves && styles.animationFramePlain,
            compact && styles.animationFrameCompact,
            !showWaves && compact && styles.animationFramePlainCompact,
            useFluidLayout && styles.animationFrameFluid,
            imageFrameStyle,
          ]}>
          {transitionSources.outgoing ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.animationLayer, contentScaleStyle, outgoingPaletteStyle]}>
              <LottieView
                source={transitionSources.outgoing}
                autoPlay={isFocused && !reducedMotion}
                loop={!reducedMotion}
                resizeMode="contain"
                style={styles.animation}
              />
            </Animated.View>
          ) : null}
          <Animated.View
            pointerEvents="none"
            style={[styles.animationLayer, contentScaleStyle, currentPaletteStyle]}>
            <LottieView
              ref={animationRef}
              source={transitionSources.current}
              autoPlay={isFocused && !reducedMotion}
              loop={!reducedMotion}
              resizeMode="contain"
              style={styles.animation}
            />
          </Animated.View>
          {themedEffectSource && !reducedMotion ? (
            <Animated.View
              pointerEvents="none"
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              style={[styles.animationLayer, contentScaleStyle]}>
              <LottieView
                source={themedEffectSource}
                autoPlay={isFocused}
                loop
                resizeMode="contain"
                style={styles.animation}
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
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
  fluidAnimationHost: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animationFrame: {
    width: IMAGE_FRAME_SIZE,
    height: IMAGE_FRAME_SIZE,
    overflow: 'hidden',
    borderCurve: 'continuous',
    borderRadius: t.borderRadius['4xl'],
  },
  animationFrameCompact: {
    width: IMAGE_FRAME_COMPACT_SIZE,
    height: IMAGE_FRAME_COMPACT_SIZE,
    borderRadius: t.borderRadius['3xl'],
  },
  animationFramePlain: {
    width: IMAGE_FRAME_PLAIN_SIZE,
    height: IMAGE_FRAME_PLAIN_SIZE,
  },
  animationFramePlainCompact: {
    width: IMAGE_FRAME_PLAIN_COMPACT_SIZE,
    height: IMAGE_FRAME_PLAIN_COMPACT_SIZE,
  },
  animationFrameFluid: {
    width: '100%',
    height: '100%',
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  animationLayer: {
    position: 'absolute',
    inset: 0,
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
