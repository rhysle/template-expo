import type { Icon } from 'phosphor-react-native'
import {
  WaveSawtoothIcon,
  WaveSineIcon,
  WaveSquareIcon,
  WaveTriangleIcon,
} from 'phosphor-react-native'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { type StyleProp, View, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { Pressable } from '@/components/base'
import type { ToneWaveform } from '@/services/audio'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

const WAVEFORM_OPTIONS = [
  { value: 'sine', icon: WaveSineIcon },
  { value: 'square', icon: WaveSquareIcon },
  { value: 'triangle', icon: WaveTriangleIcon },
  { value: 'sawtooth', icon: WaveSawtoothIcon },
] as const satisfies readonly { value: ToneWaveform; icon: Icon }[]

const OPTION_SIZE = 44
const INDICATOR_SIZE = 36
const INDICATOR_INSET = (OPTION_SIZE - INDICATOR_SIZE) / 2
const INDICATOR_SPRING_CONFIG = {
  damping: 22,
  stiffness: 210,
  mass: 0.8,
} as const

interface ToneWaveformPickerProps {
  value: ToneWaveform
  onValueChange: (waveform: ToneWaveform) => void
  disabled?: boolean
  haptic?: boolean
  style?: StyleProp<ViewStyle>
}

interface WaveformOptionProps {
  disabled: boolean
  haptic: boolean
  icon: Icon
  selected: boolean
  value: ToneWaveform
  onValueChange: (waveform: ToneWaveform) => void
}

const WaveformOption = ({
  disabled,
  haptic,
  icon: IconComponent,
  selected,
  value,
  onValueChange,
}: WaveformOptionProps) => {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const waveformLabels: Record<ToneWaveform, string> = {
    sine: t('audioTools.tone.waveform.sine'),
    square: t('audioTools.tone.waveform.square'),
    triangle: t('audioTools.tone.waveform.triangle'),
    sawtooth: t('audioTools.tone.waveform.sawtooth'),
  }

  return (
    <Pressable
      accessibilityLabel={waveformLabels[value]}
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      haptic={haptic && !disabled && !selected}
      hapticType="selection"
      onPress={() => onValueChange(value)}
      style={styles.option}>
      <IconComponent
        size={iconSizes.lg}
        color={selected ? colors.text.inverse : colors.primary.main}
        weight="bold"
      />
    </Pressable>
  )
}

export const ToneWaveformPicker = ({
  value,
  onValueChange,
  disabled = false,
  haptic = true,
  style,
}: ToneWaveformPickerProps) => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const reducedMotion = useReducedMotion()
  const selectedIndex = Math.max(
    WAVEFORM_OPTIONS.findIndex((option) => option.value === value),
    0
  )
  const indicatorX = useSharedValue(selectedIndex * OPTION_SIZE)

  useEffect(() => {
    const targetX = selectedIndex * OPTION_SIZE
    indicatorX.value = reducedMotion ? targetX : withSpring(targetX, INDICATOR_SPRING_CONFIG)
  }, [indicatorX, reducedMotion, selectedIndex])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }))

  return (
    <View
      accessibilityLabel={t('audioTools.tone.waveform.label')}
      accessibilityRole="radiogroup"
      style={[styles.pill, style]}>
      <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
      {WAVEFORM_OPTIONS.map((option) => (
        <WaveformOption
          key={option.value}
          disabled={disabled}
          haptic={haptic}
          icon={option.icon}
          selected={option.value === value}
          value={option.value}
          onValueChange={onValueChange}
        />
      ))}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    padding: t.spacing.xs,
    borderCurve: 'continuous',
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
}))
