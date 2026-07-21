import { Image } from 'expo-image'
import { useEffect } from 'react'
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

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

interface MascotHeroProps {
  active?: boolean
  accentColor?: string
  compact?: boolean
  style?: StyleProp<ViewStyle>
}

export const MascotHero = ({
  active = false,
  accentColor,
  compact = false,
  style,
}: MascotHeroProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const reducedMotion = useReducedMotion()
  const pulse = useSharedValue(0)
  const resolvedAccent = accentColor ?? theme.colors.primary.main

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

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.025 }],
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
    <View style={[styles.container, compact && styles.containerCompact, style]}>
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
      <Animated.View style={[styles.imageFrame, compact && styles.imageFrameCompact, imageStyle]}>
        <Image
          accessibilityLabel={t('audioTools.common.mascot')}
          source={require('@/assets/images/mascot.png')}
          contentFit="cover"
          transition={180}
          style={styles.image}
        />
      </Animated.View>
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
  imageFrame: {
    width: 208,
    height: 208,
    overflow: 'hidden',
    borderCurve: 'continuous',
    borderRadius: t.borderRadius['4xl'],
  },
  imageFrameCompact: {
    width: 156,
    height: 156,
    borderRadius: t.borderRadius['3xl'],
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
