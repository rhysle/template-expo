import { PlayIcon, StopIcon } from 'phosphor-react-native'
import { useEffect } from 'react'
import { ActivityIndicator, type StyleProp, View, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { Pressable } from '@/components/base'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

interface CircularAudioButtonProps {
  active: boolean
  accessibilityLabel: string
  onPress: () => void
  size?: 'default' | 'large'
  loading?: boolean
  disabled?: boolean
  haptic?: boolean
  pulsing?: boolean
  style?: StyleProp<ViewStyle>
}

const PULSE_DURATION = 1_600
const PULSE_MAX_SCALE = 1.28

export const CircularAudioButton = ({
  active,
  accessibilityLabel,
  onPress,
  size = 'default',
  loading = false,
  disabled = false,
  haptic = true,
  pulsing = false,
  style,
}: CircularAudioButtonProps) => {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const reducedMotion = useReducedMotion()
  const pulse = useSharedValue(0)
  const isLarge = size === 'large'
  const shouldPulse = pulsing && !active && !disabled && !loading

  useEffect(() => {
    cancelAnimation(pulse)

    if (!shouldPulse || reducedMotion) {
      pulse.value = 0
      return
    }

    pulse.value = withRepeat(
      withTiming(1, {
        duration: PULSE_DURATION,
        easing: Easing.out(Easing.quad),
      }),
      -1,
      false,
      undefined,
      ReduceMotion.System
    )

    return () => cancelAnimation(pulse)
  }, [pulse, reducedMotion, shouldPulse])

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.72, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, PULSE_MAX_SCALE]) }],
  }))

  return (
    <View style={[styles.halo, isLarge && styles.haloLarge, active && styles.haloActive, style]}>
      {shouldPulse ? (
        <Animated.View pointerEvents="none" style={[styles.pulseRing, pulseStyle]} />
      ) : null}
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled }}
        disabled={disabled || loading}
        haptic={haptic}
        hapticType="medium"
        onPress={onPress}
        style={[styles.button, isLarge && styles.buttonLarge, active && styles.buttonActive]}>
        {loading ? (
          <ActivityIndicator color={theme.colors.text.inverse} />
        ) : active ? (
          <StopIcon size={iconSizes.xl} color={theme.colors.text.inverse} weight="fill" />
        ) : (
          <PlayIcon size={iconSizes.xl} color={theme.colors.text.inverse} weight="fill" />
        )}
      </Pressable>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  halo: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: withAlpha(t.colors.primary.main, 0.1),
  },
  haloActive: {
    backgroundColor: withAlpha(t.colors.status.error, 0.1),
  },
  pulseRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: t.borderRadius.full,
    backgroundColor: withAlpha(t.colors.primary.main, 0.24),
  },
  haloLarge: {
    width: 152,
    height: 152,
  },
  button: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.main,
    ...t.shadows.lg,
  },
  buttonActive: {
    backgroundColor: t.colors.status.error,
  },
  buttonLarge: {
    width: 124,
    height: 124,
  },
}))
