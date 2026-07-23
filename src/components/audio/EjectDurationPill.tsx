import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { type StyleProp, View, type ViewStyle } from 'react-native'
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { Pressable, Text } from '@/components/base'
import {
  type EjectDurationSeconds,
  useAudioPreferencesState,
} from '@/stores/features/audioPreferences'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

const DURATION_OPTIONS = [30, 60, 90] as const satisfies readonly EjectDurationSeconds[]
const OPTION_SIZE = 44
const INDICATOR_SIZE = 38
const INDICATOR_INSET = (OPTION_SIZE - INDICATOR_SIZE) / 2
const INDICATOR_SPRING_CONFIG = {
  damping: 22,
  stiffness: 210,
  mass: 0.8,
} as const

interface EjectDurationPillProps {
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

interface DurationOptionProps {
  disabled: boolean
  duration: EjectDurationSeconds
  hapticsEnabled: boolean
  index: number
  indicatorY: SharedValue<number>
  onSelect: (duration: EjectDurationSeconds) => void
  optionStride: number
  selected: boolean
}

const DurationOption = ({
  disabled,
  duration,
  hapticsEnabled,
  index,
  indicatorY,
  onSelect,
  optionStride,
  selected,
}: DurationOptionProps) => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const targetY = index * optionStride

  const selectedLabelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(indicatorY.value - targetY)
    const progress = 1 - Math.min(distance / optionStride, 1)

    return {
      opacity: progress,
      transform: [{ scale: 0.94 + progress * 0.06 }],
    }
  })

  const unselectedLabelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(indicatorY.value - targetY)
    const progress = 1 - Math.min(distance / optionStride, 1)

    return { opacity: 1 - progress }
  })

  return (
    <Pressable
      accessibilityLabel={t('settings.audio.durationValue', { count: duration })}
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      haptic={hapticsEnabled && !disabled && !selected}
      hapticType="selection"
      hitSlop={2}
      onPress={() => onSelect(duration)}
      style={[
        styles.option,
        disabled && selected && styles.optionSelectedDisabled,
        disabled && !selected && styles.optionDisabled,
      ]}>
      <Animated.View style={[styles.labelLayer, unselectedLabelStyle]}>
        <Text variant="caption" weight="semibold" style={styles.optionLabel}>
          {duration}s
        </Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.labelLayer, selectedLabelStyle]}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.optionLabel, styles.optionLabelSelected]}>
          {duration}s
        </Text>
      </Animated.View>
    </Pressable>
  )
}

export const EjectDurationPill = ({ disabled = false, style }: EjectDurationPillProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const reducedMotion = useReducedMotion()
  const { ejectDurationSeconds, hapticsEnabled, setEjectDurationSeconds } =
    useAudioPreferencesState()
  const selectedIndex = Math.max(DURATION_OPTIONS.indexOf(ejectDurationSeconds), 0)
  const optionStride = OPTION_SIZE + theme.spacing.xs
  const indicatorY = useSharedValue(selectedIndex * optionStride)

  useEffect(() => {
    const targetY = selectedIndex * optionStride
    indicatorY.value = reducedMotion ? targetY : withSpring(targetY, INDICATOR_SPRING_CONFIG)
  }, [indicatorY, optionStride, reducedMotion, selectedIndex])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: indicatorY.value }],
  }))

  return (
    <View
      accessibilityLabel={t('settings.audio.ejectDuration')}
      accessibilityRole="radiogroup"
      style={[styles.pill, style]}>
      <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
      {DURATION_OPTIONS.map((duration, index) => (
        <DurationOption
          key={duration}
          disabled={disabled}
          duration={duration}
          hapticsEnabled={hapticsEnabled}
          index={index}
          indicatorY={indicatorY}
          onSelect={setEjectDurationSeconds}
          optionStride={optionStride}
          selected={ejectDurationSeconds === duration}
        />
      ))}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  pill: {
    width: 52,
    alignItems: 'center',
    gap: t.spacing.xs,
    padding: t.spacing.xs,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.background.subtle,
  },
  indicator: {
    position: 'absolute',
    top: t.spacing.xs + INDICATOR_INSET,
    left: t.spacing.xs + INDICATOR_INSET,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.main,
  },
  option: {
    width: OPTION_SIZE,
    height: OPTION_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
  },
  labelLayer: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelectedDisabled: {
    opacity: 1,
  },
  optionDisabled: {
    opacity: 0.45,
  },
  optionLabel: {
    color: t.colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  optionLabelSelected: {
    color: t.colors.text.inverse,
  },
}))
