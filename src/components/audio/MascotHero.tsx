import { Image } from 'expo-image'
import { useIsFocused } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type StyleProp, View, type ViewStyle } from 'react-native'
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

import { createThemedStyles, useThemedStyles } from '@/theme'

const IMAGE_FRAME_SIZE = 336
const IMAGE_FRAME_COMPACT_SIZE = 244
const IMAGE_PULSE_SCALE = 0.025
const VISUAL_TRANSITION_DURATION = 220

interface TransitionSources {
  current: number
  outgoing?: number
}

export interface MascotHeroProps {
  active?: boolean
  compact?: boolean
  fillAvailableSpace?: boolean
  source: number
  style?: StyleProp<ViewStyle>
}

export const MascotHero = ({
  active = false,
  compact = false,
  fillAvailableSpace = false,
  source,
  style,
}: MascotHeroProps) => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const isFocused = useIsFocused()
  const reducedMotion = useReducedMotion()
  const pulse = useSharedValue(0)
  const transition = useSharedValue(1)
  const currentSourceRef = useRef(source)
  const [transitionSources, setTransitionSources] = useState<TransitionSources>({
    current: source,
  })

  useEffect(() => {
    const outgoing = currentSourceRef.current
    if (reducedMotion) {
      currentSourceRef.current = source
      transition.value = 1
      setTransitionSources({ current: source })
      return
    }
    if (outgoing === source) return

    currentSourceRef.current = source

    setTransitionSources({ current: source, outgoing })
    transition.value = 0
    transition.value = withTiming(1, {
      duration: VISUAL_TRANSITION_DURATION,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    })

    const cleanupTimer = setTimeout(
      () => setTransitionSources({ current: source }),
      VISUAL_TRANSITION_DURATION
    )
    return () => clearTimeout(cleanupTimer)
  }, [reducedMotion, source, transition])

  useEffect(() => {
    cancelAnimation(pulse)
    if (active && isFocused && !reducedMotion) {
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
  }, [active, isFocused, pulse, reducedMotion])

  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * IMAGE_PULSE_SCALE }],
  }))
  const currentStyle = useAnimatedStyle(() => ({
    opacity: transition.value,
    transform: [{ scale: 0.96 + transition.value * 0.04 }],
  }))
  const outgoingStyle = useAnimatedStyle(() => ({
    opacity: 1 - transition.value,
    transform: [{ scale: 1 + transition.value * 0.02 }],
  }))

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        fillAvailableSpace && styles.containerFill,
        style,
      ]}>
      <Animated.View
        accessible
        accessibilityLabel={t('audioTools.common.mascot')}
        accessibilityRole="image"
        style={[
          styles.imageFrame,
          compact && styles.imageFrameCompact,
          fillAvailableSpace && styles.imageFrameFluid,
          frameStyle,
        ]}>
        {transitionSources.outgoing ? (
          <Animated.View pointerEvents="none" style={[styles.imageLayer, outgoingStyle]}>
            <Image source={transitionSources.outgoing} contentFit="contain" style={styles.image} />
          </Animated.View>
        ) : null}
        <Animated.View pointerEvents="none" style={[styles.imageLayer, currentStyle]}>
          <Image source={transitionSources.current} contentFit="contain" style={styles.image} />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const createStyles = createThemedStyles(() => ({
  container: {
    width: IMAGE_FRAME_SIZE,
    height: IMAGE_FRAME_SIZE,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerCompact: {
    width: IMAGE_FRAME_COMPACT_SIZE,
    height: IMAGE_FRAME_COMPACT_SIZE,
  },
  containerFill: {
    minHeight: 0,
    flex: 1,
    width: '100%',
    height: 'auto',
  },
  imageFrame: {
    width: IMAGE_FRAME_SIZE,
    height: IMAGE_FRAME_SIZE,
  },
  imageFrameCompact: {
    width: IMAGE_FRAME_COMPACT_SIZE,
    height: IMAGE_FRAME_COMPACT_SIZE,
  },
  imageFrameFluid: {
    width: '100%',
    height: '100%',
  },
  imageLayer: {
    position: 'absolute',
    inset: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
}))
