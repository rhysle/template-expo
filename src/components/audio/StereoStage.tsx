import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Rect } from 'react-native-svg'

import { Pressable, Text } from '@/components/base'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

interface StereoStageProps {
  leftActive: boolean
  rightActive: boolean
  playing: boolean
  compact?: boolean
  leftLabel: string
  rightLabel: string
  onToggleLeft: () => void
  onToggleRight: () => void
  haptic?: boolean
}

interface SpeakerControlProps {
  active: boolean
  playing: boolean
  compact: boolean
  label: string
  accessibilityLabel: string
  onPress: () => void
  haptic: boolean
}

interface LevelBarProps {
  active: boolean
  index: number
}

const LEVEL_HEIGHTS = [10, 18, 26, 16, 9]

const LevelBar = ({ active, index }: LevelBarProps) => {
  const styles = useThemedStyles(createStyles)
  const reduceMotion = useReducedMotion()
  const level = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    cancelAnimation(level)
    if (!active) {
      level.value = withTiming(0, { duration: 180 })
      return
    }
    if (reduceMotion) {
      level.value = 1
      return
    }

    level.value = withDelay(
      index * 70,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 260 + index * 25 }),
          withTiming(0.42, { duration: 300 + (4 - index) * 30 })
        ),
        -1,
        true
      )
    )
  }, [active, index, level, reduceMotion])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(level.value, [0, 1], [0.22, 1]),
    transform: [{ scaleY: interpolate(level.value, [0, 1], [0.45, 1]) }],
  }))

  return (
    <Animated.View style={[styles.levelBar, { height: LEVEL_HEIGHTS[index] }, animatedStyle]} />
  )
}

const SpeakerControl = ({
  active,
  playing,
  compact,
  label,
  accessibilityLabel,
  onPress,
  haptic,
}: SpeakerControlProps) => {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const reduceMotion = useReducedMotion()
  const pulse = useSharedValue(0)
  const pulseDelayed = useSharedValue(0)
  const energy = useSharedValue(active ? 1 : 0)
  const energized = active && playing

  useEffect(() => {
    cancelAnimation(pulse)
    cancelAnimation(pulseDelayed)
    cancelAnimation(energy)

    if (!energized) {
      pulse.value = withTiming(0, { duration: 180 })
      pulseDelayed.value = withTiming(0, { duration: 180 })
      energy.value = withTiming(active ? 1 : 0, { duration: 220 })
      return
    }

    if (reduceMotion) {
      pulse.value = 0.28
      pulseDelayed.value = 0
      energy.value = 1
      return
    }

    pulse.value = withRepeat(withTiming(1, { duration: 1050 }), -1, false)
    pulseDelayed.value = withDelay(450, withRepeat(withTiming(1, { duration: 1050 }), -1, false))
    energy.value = withRepeat(
      withSequence(withTiming(1, { duration: 420 }), withTiming(0.7, { duration: 420 })),
      -1,
      true
    )
  }, [active, energized, energy, pulse, pulseDelayed, reduceMotion])

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.3, 1], [0, 0.3, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.86, 1.22]) }],
  }))
  const delayedPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseDelayed.value, [0, 0.3, 1], [0, 0.22, 0]),
    transform: [{ scale: interpolate(pulseDelayed.value, [0, 1], [0.86, 1.34]) }],
  }))
  const speakerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(energy.value, [0, 1], [0.985, 1]) }],
  }))

  const activeColor = theme.colors.primary.main
  const cabinetFill = active
    ? theme.colors.primary.soft
    : withAlpha(theme.colors.primary.soft, 0.62)
  const cabinetStroke = active ? activeColor : theme.colors.border.default
  const coneFill = active
    ? withAlpha(theme.colors.primary.main, 0.16)
    : theme.colors.background.surface
  const coneStroke = active ? activeColor : theme.colors.border.strong

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      haptic={haptic}
      hapticType="medium"
      onPress={onPress}
      style={({ pressed }) => [
        styles.speakerPressable,
        compact && styles.speakerPressableCompact,
        pressed && styles.speakerPressed,
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.pulseRing, compact && styles.pulseRingCompact, pulseStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.pulseRing, compact && styles.pulseRingCompact, delayedPulseStyle]}
      />

      <Animated.View style={[styles.speakerIllustration, speakerStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 148 260">
          <Rect
            x={3}
            y={3}
            width={142}
            height={254}
            rx={25}
            fill={cabinetFill}
            stroke={cabinetStroke}
            strokeWidth={active ? 3 : 2}
          />
          <Circle cx={74} cy={57} r={28} fill={theme.colors.background.surface} />
          <Circle cx={74} cy={57} r={20} fill={coneFill} stroke={coneStroke} strokeWidth={4} />
          <Circle cx={74} cy={57} r={7} fill={active ? activeColor : cabinetStroke} />

          <Circle cx={74} cy={148} r={54} fill={theme.colors.background.surface} />
          <Circle cx={74} cy={148} r={45} fill={coneFill} stroke={coneStroke} strokeWidth={5} />
          <Circle
            cx={74}
            cy={148}
            r={22}
            fill={active ? activeColor : theme.colors.background.subtle}
            stroke={coneStroke}
            strokeWidth={4}
          />
          <Circle cx={22} cy={24} r={3} fill={withAlpha(cabinetStroke, 0.65)} />
          <Circle cx={126} cy={24} r={3} fill={withAlpha(cabinetStroke, 0.65)} />
          <Circle cx={22} cy={236} r={3} fill={withAlpha(cabinetStroke, 0.65)} />
          <Circle cx={126} cy={236} r={3} fill={withAlpha(cabinetStroke, 0.65)} />
        </Svg>
      </Animated.View>

      <View style={styles.levelBars} pointerEvents="none">
        {LEVEL_HEIGHTS.map((_, index) => (
          <LevelBar key={index} index={index} active={energized} />
        ))}
      </View>
      <Text variant="subtitle" weight="bold" tone={active ? 'accent' : 'muted'} align="center">
        {label}
      </Text>
    </Pressable>
  )
}

export const StereoStage = ({
  leftActive,
  rightActive,
  playing,
  compact = false,
  leftLabel,
  rightLabel,
  onToggleLeft,
  onToggleRight,
  haptic = true,
}: StereoStageProps) => (
  <View style={[stageStyles.row, compact && stageStyles.rowCompact]}>
    <SpeakerControl
      active={leftActive}
      playing={playing}
      compact={compact}
      label={leftLabel}
      accessibilityLabel={leftLabel}
      onPress={onToggleLeft}
      haptic={haptic}
    />
    <SpeakerControl
      active={rightActive}
      playing={playing}
      compact={compact}
      label={rightLabel}
      accessibilityLabel={rightLabel}
      onPress={onToggleRight}
      haptic={haptic}
    />
  </View>
)

const stageStyles = {
  row: {
    width: '100%' as const,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
    gap: 16,
  },
  rowCompact: {
    gap: 12,
  },
}

const createStyles = createThemedStyles((t) => ({
  speakerPressable: {
    flex: 1,
    maxWidth: 188,
    minWidth: 0,
    alignItems: 'center',
    gap: t.spacing.sm,
    overflow: 'visible',
  },
  speakerPressableCompact: {
    maxWidth: 164,
  },
  speakerPressed: {
    transform: [{ scale: 0.98 }],
  },
  speakerIllustration: {
    zIndex: 1,
    width: '100%',
    aspectRatio: 148 / 260,
  },
  pulseRing: {
    position: 'absolute',
    zIndex: 2,
    top: 96,
    left: '50%',
    width: 180,
    height: 180,
    marginLeft: -90,
    borderRadius: t.borderRadius.full,
    borderWidth: 3,
    borderColor: t.colors.primary.main,
    backgroundColor: withAlpha(t.colors.primary.main, 0.035),
  },
  pulseRingCompact: {
    top: 78,
    width: 154,
    height: 154,
    marginLeft: -77,
  },
  levelBars: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: t.spacing.xs,
  },
  levelBar: {
    width: 4,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.main,
    transformOrigin: 'bottom',
  },
}))
