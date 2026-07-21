import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type AccessibilityActionEvent, type LayoutChangeEvent, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import {
  AudioToolScreen,
  CircularAudioButton,
  FrequencyWaveform,
  MascotHero,
} from '@/components/audio'
import { ChoiceChip, InlineNotice, NativeSlider, StatusBadge, Text } from '@/components/base'
import {
  audioController,
  type FrequencyBand,
  frequencyFromNormalized,
  getFrequencyBand,
  normalizeFrequency,
  useAudioController,
  useAudioToolLifecycle,
} from '@/services/audio'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

const PRESETS = [165, 250, 440, 1_000, 8_000, 12_000] as const

export default function ToneGeneratorScreen() {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const snapshot = useAudioController()
  const { hapticsEnabled, lastToneFrequencyHz, setLastToneFrequencyHz } = useAudioPreferencesState()
  const [frequencyHz, setFrequencyHz] = useState(lastToneFrequencyHz)
  const gestureWidth = useSharedValue(1)
  const gestureStart = useSharedValue(normalizeFrequency(lastToneFrequencyHz))
  const currentPosition = useSharedValue(normalizeFrequency(lastToneFrequencyHz))
  useAudioToolLifecycle()

  const isRunning = snapshot.activeTool === 'tone' && snapshot.status === 'running'
  const isStarting = snapshot.activeTool === 'tone' && snapshot.status === 'starting'
  const isActive = isRunning || isStarting
  const isLastToneSession = snapshot.lastTool === 'tone'
  const band = getFrequencyBand(frequencyHz)
  const formattedFrequency = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(frequencyHz)

  const bandColors: Record<FrequencyBand, string> = {
    veryLow: theme.colors.primary.strong,
    low: theme.colors.primary.main,
    midLow: theme.colors.status.success,
    mid: theme.colors.status.warning,
    high: theme.colors.status.warning,
    veryHigh: theme.colors.status.error,
  }
  const bandLabels: Record<FrequencyBand, string> = {
    veryLow: t('audioTools.tone.band.veryLow'),
    low: t('audioTools.tone.band.low'),
    midLow: t('audioTools.tone.band.midLow'),
    mid: t('audioTools.tone.band.mid'),
    high: t('audioTools.tone.band.high'),
    veryHigh: t('audioTools.tone.band.veryHigh'),
  }
  const waveformColor = bandColors[band]

  useEffect(() => {
    currentPosition.value = normalizeFrequency(frequencyHz)
    const timer = setTimeout(() => setLastToneFrequencyHz(frequencyHz), 250)
    return () => clearTimeout(timer)
  }, [currentPosition, frequencyHz, setLastToneFrequencyHz])

  const applyFrequencyPosition = (position: number) => {
    const nextFrequency = frequencyFromNormalized(position)
    setFrequencyHz(nextFrequency)
    if (isRunning) audioController.setToneFrequency(nextFrequency)
  }

  const adjustFrequency = (direction: 'increment' | 'decrement') => {
    const multiplier = direction === 'increment' ? 1.1 : 1 / 1.1
    const nextFrequency = Math.min(Math.max(Math.round(frequencyHz * multiplier), 20), 20_000)
    setFrequencyHz(nextFrequency)
    if (isRunning) audioController.setToneFrequency(nextFrequency)
  }

  const panGesture = Gesture.Pan()
    .onStart(() => {
      gestureStart.value = currentPosition.value
    })
    .onUpdate(({ translationX }) => {
      const nextPosition = Math.min(
        Math.max(gestureStart.value + translationX / gestureWidth.value, 0),
        1
      )
      scheduleOnRN(applyFrequencyPosition, nextPosition)
    })

  const handleWaveformLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    gestureWidth.value = Math.max(nativeEvent.layout.width, 1)
  }

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === 'increment' || nativeEvent.actionName === 'decrement') {
      adjustFrequency(nativeEvent.actionName)
    }
  }

  const handleMainPress = () => {
    if (isActive) void audioController.stop('manual')
    else void audioController.startTone(frequencyHz)
  }

  return (
    <AudioToolScreen>
      <View style={styles.intro}>
        <Text variant="body" tone="secondary" align="center">
          {t('audioTools.tone.subtitle')}
        </Text>
        <StatusBadge label={bandLabels[band]} tone="accent" />
      </View>

      <MascotHero active={isRunning} compact accentColor={waveformColor} />

      <View style={styles.frequencyBlock}>
        <Text variant="caption" tone="secondary" align="center">
          {t('audioTools.tone.currentFrequency')}
        </Text>
        <View style={styles.frequencyRow}>
          <Text variant="title" weight="bold" align="center" style={{ color: waveformColor }}>
            {formattedFrequency}
          </Text>
          <Text variant="subtitle" weight="semibold" tone="secondary">
            Hz
          </Text>
        </View>

        <GestureDetector gesture={panGesture}>
          <View
            accessible
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            accessibilityLabel={t('audioTools.tone.waveformLabel', {
              frequency: formattedFrequency,
            })}
            accessibilityRole="adjustable"
            accessibilityValue={{
              min: 20,
              max: 20_000,
              now: frequencyHz,
              text: `${formattedFrequency} Hz`,
            }}
            onAccessibilityAction={handleAccessibilityAction}
            onLayout={handleWaveformLayout}>
            <FrequencyWaveform
              frequencyHz={frequencyHz}
              active={isRunning}
              color={waveformColor}
              accessibilityLabel={t('audioTools.tone.waveformLabel', {
                frequency: formattedFrequency,
              })}
            />
          </View>
        </GestureDetector>

        <NativeSlider
          min={0}
          max={1}
          value={normalizeFrequency(frequencyHz)}
          onValueChange={applyFrequencyPosition}
        />
        <View style={styles.rangeLabels}>
          <Text variant="caption" tone="muted">
            20 Hz
          </Text>
          <Text variant="caption" tone="muted">
            20,000 Hz
          </Text>
        </View>
        <Text variant="caption" tone="secondary" align="center">
          {t('audioTools.tone.swipeHint')}
        </Text>
      </View>

      <View style={styles.presetSection}>
        <Text variant="subtitle" weight="semibold">
          {t('audioTools.tone.presets')}
        </Text>
        <View style={styles.presetRow}>
          {PRESETS.map((preset) => (
            <ChoiceChip
              key={preset}
              label={`${new Intl.NumberFormat().format(preset)} Hz`}
              selected={frequencyHz === preset}
              haptic={hapticsEnabled}
              onPress={() => {
                setFrequencyHz(preset)
                if (isRunning) audioController.setToneFrequency(preset)
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.playSection}>
        <CircularAudioButton
          active={isActive}
          loading={isStarting || snapshot.status === 'stopping'}
          haptic={hapticsEnabled}
          accessibilityLabel={isActive ? t('audioTools.tone.stop') : t('audioTools.tone.play')}
          onPress={handleMainPress}
        />
        <Text variant="subtitle" weight="semibold" tone="accent" align="center">
          {isActive ? t('audioTools.tone.stop') : t('audioTools.tone.play')}
        </Text>
      </View>

      {snapshot.status === 'error' && isLastToneSession ? (
        <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
      ) : null}
      <InlineNotice compact>{t('audioTools.common.gradualVolume')}</InlineNotice>
    </AudioToolScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  intro: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  frequencyBlock: {
    gap: t.spacing.md,
  },
  frequencyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetSection: {
    gap: t.spacing.md,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  playSection: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
}))
