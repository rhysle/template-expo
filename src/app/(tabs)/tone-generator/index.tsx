import { Image } from 'expo-image'
import { SpeakerLowIcon, WaveformIcon } from 'phosphor-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import {
  AudioToolScreen,
  CircularAudioButton,
  FrequencyWaveform,
  MascotHero,
} from '@/components/audio'
import {
  ChoiceChip,
  InlineNotice,
  MorphingNumber,
  NativeSlider,
  StatusBadge,
  Text,
} from '@/components/base'
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
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

const PRESETS = [165, 250, 440, 1_000, 5_000] as const
const CENTER_FADE_INTENSITY = 0.3
const EDGE_FADE_INTENSITY = 1

export default function ToneGeneratorScreen() {
  const { i18n, t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const { height, width } = useWindowDimensions()
  const snapshot = useAudioController()
  const { hapticsEnabled, lastToneFrequencyHz, setLastToneFrequencyHz } = useAudioPreferencesState()
  const [frequencyHz, setFrequencyHz] = useState(lastToneFrequencyHz)
  const [presetSelectionFrequencyHz, setPresetSelectionFrequencyHz] = useState(lastToneFrequencyHz)
  const gestureWidth = useSharedValue(1)
  const gestureStart = useSharedValue(normalizeFrequency(lastToneFrequencyHz))
  const currentPosition = useSharedValue(normalizeFrequency(lastToneFrequencyHz))
  useAudioToolLifecycle()

  const isRunning = snapshot.activeTool === 'tone' && snapshot.status === 'running'
  const isStarting = snapshot.activeTool === 'tone' && snapshot.status === 'starting'
  const isActive = isRunning || isStarting
  const isLastToneSession = snapshot.lastTool === 'tone'
  const isCompactLayout = height < 900
  const band = getFrequencyBand(frequencyHz)
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language, {
    maximumFractionDigits: 0,
  })
  const formattedFrequency = numberFormatter.format(frequencyHz)

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
  const frequencyValueColor = theme.colors.primary.main

  useEffect(() => {
    currentPosition.value = normalizeFrequency(frequencyHz)
    const timer = setTimeout(() => setLastToneFrequencyHz(frequencyHz), 250)
    return () => clearTimeout(timer)
  }, [currentPosition, frequencyHz, setLastToneFrequencyHz])

  const applyFrequencyPosition = (position: number) => {
    const nextFrequency = frequencyFromNormalized(position)
    currentPosition.value = position
    setFrequencyHz(nextFrequency)
    if (isRunning) audioController.setToneFrequency(nextFrequency)
  }

  const commitFrequencyPosition = (position: number) => {
    const nextFrequency = frequencyFromNormalized(position)
    currentPosition.value = position
    setFrequencyHz(nextFrequency)
    setPresetSelectionFrequencyHz(nextFrequency)
    if (isRunning) audioController.setToneFrequency(nextFrequency)
  }

  const adjustFrequency = (direction: 'increment' | 'decrement') => {
    const multiplier = direction === 'increment' ? 1.1 : 1 / 1.1
    const nextFrequency = Math.min(Math.max(Math.round(frequencyHz * multiplier), 20), 20_000)
    currentPosition.value = normalizeFrequency(nextFrequency)
    setFrequencyHz(nextFrequency)
    setPresetSelectionFrequencyHz(nextFrequency)
    if (isRunning) audioController.setToneFrequency(nextFrequency)
  }

  const selectPreset = (preset: (typeof PRESETS)[number]) => {
    currentPosition.value = normalizeFrequency(preset)
    setFrequencyHz(preset)
    setPresetSelectionFrequencyHz(preset)
    if (isRunning) audioController.setToneFrequency(preset)
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
    .onEnd(({ translationX }) => {
      const nextPosition = Math.min(
        Math.max(gestureStart.value + translationX / gestureWidth.value, 0),
        1
      )
      scheduleOnRN(commitFrequencyPosition, nextPosition)
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

  const actionDock = (
    <View style={[styles.actionDock, isCompactLayout && styles.actionDockCompact]}>
      <View style={styles.actionControlRow}>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.actionOrnament}>
          <Image
            source={require('@/assets/images/tone-wave-ornament.png')}
            contentFit="contain"
            style={styles.actionOrnamentImage}
          />
        </View>
        <CircularAudioButton
          active={isActive}
          haptic={hapticsEnabled}
          accessibilityLabel={isActive ? t('audioTools.tone.stop') : t('audioTools.tone.play')}
          onPress={handleMainPress}
        />
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.actionOrnament}>
          <Image
            source={require('@/assets/images/tone-wave-ornament.png')}
            contentFit="contain"
            style={styles.actionOrnamentImage}
          />
        </View>
      </View>
      <Text
        variant="subtitle"
        weight="semibold"
        tone="accent"
        align="center"
        style={{ color: isActive ? theme.colors.status.error : theme.colors.primary.main }}>
        {isActive ? t('audioTools.tone.stop') : t('audioTools.tone.play')}
      </Text>
      <View style={styles.safetyCue}>
        <SpeakerLowIcon size={iconSizes.md} color={theme.colors.text.secondary} weight="regular" />
        <Text variant="caption" tone="secondary" align="center" style={styles.safetyText}>
          {t('audioTools.tone.volumeHint')}
        </Text>
      </View>
    </View>
  )

  return (
    <AudioToolScreen
      variant="focused"
      contentStyle={[styles.content, isCompactLayout && styles.contentCompact]}>
      <View style={styles.intro}>
        <StatusBadge
          label={bandLabels[band]}
          tone="accent"
          icon={WaveformIcon}
          style={styles.status}
        />
        <Text variant="body" tone="secondary" align="center">
          {t('audioTools.tone.subtitle')}
        </Text>
      </View>

      <MascotHero
        active={isRunning}
        compact={isCompactLayout}
        showWaves={false}
        accentColor={waveformColor}
        style={[styles.mascot, isCompactLayout && styles.mascotCompact]}
      />

      <View style={styles.frequencyBlock}>
        <GestureDetector gesture={panGesture}>
          <View
            accessible
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            accessibilityLabel={`${t('audioTools.tone.currentFrequency')}: ${formattedFrequency} Hz`}
            accessibilityRole="adjustable"
            accessibilityValue={{
              min: 20,
              max: 20_000,
              now: frequencyHz,
              text: `${formattedFrequency} Hz`,
            }}
            onAccessibilityAction={handleAccessibilityAction}
            onLayout={handleWaveformLayout}
            style={[styles.waveformAdjuster, { width }]}>
            <FrequencyWaveform
              frequencyHz={frequencyHz}
              active={isRunning}
              color={theme.colors.primary.main}
              accessibilityLabel={t('audioTools.tone.waveformLabel', {
                frequency: formattedFrequency,
              })}
              centerFadeIntensity={CENTER_FADE_INTENSITY}
              edgeFadeIntensity={EDGE_FADE_INTENSITY}
              style={[styles.waveform, isCompactLayout && styles.waveformCompact]}
            />
            <View pointerEvents="none" style={styles.frequencyOverlay}>
              <View style={styles.frequencyRow}>
                <MorphingNumber
                  value={frequencyHz}
                  formattedValue={formattedFrequency}
                  color={frequencyValueColor}
                  outlineColor={theme.colors.text.inverse}
                  textStyle={styles.frequencyValue}
                />
                <Text variant="subtitle" weight="semibold" tone="secondary" style={styles.unit}>
                  Hz
                </Text>
              </View>
            </View>
          </View>
        </GestureDetector>

        <View style={styles.sliderBlock}>
          <NativeSlider
            min={0}
            max={1}
            value={normalizeFrequency(frequencyHz)}
            onValueChange={applyFrequencyPosition}
            onValueChangeFinished={() => {
              setPresetSelectionFrequencyHz(frequencyFromNormalized(currentPosition.value))
            }}
          />
          <View style={styles.rangeLabels}>
            <Text variant="caption" tone="muted">
              {numberFormatter.format(20)} Hz
            </Text>
            <Text variant="caption" tone="muted">
              {numberFormatter.format(20_000)} Hz
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.presetRow}>
        {PRESETS.map((preset) => (
          <ChoiceChip
            key={preset}
            label={`${numberFormatter.format(preset)} Hz`}
            selected={presetSelectionFrequencyHz === preset}
            haptic={hapticsEnabled}
            onPress={() => selectPreset(preset)}
            style={styles.quickPreset}
          />
        ))}
      </View>

      {actionDock}

      {snapshot.status === 'error' && isLastToneSession ? (
        <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
      ) : null}
    </AudioToolScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  content: {
    gap: t.spacing.md,
  },
  contentCompact: {
    gap: t.spacing.sm,
  },
  intro: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  status: {
    alignSelf: 'center',
  },
  mascot: {
    transform: [{ scale: 1.4 }],
    marginVertical: t.spacing.xs,
  },
  mascotCompact: {
    transform: [{ scale: 0.96 }],
    marginVertical: -t.spacing.sm,
  },
  frequencyBlock: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  frequencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: t.spacing.xs,
  },
  frequencyValue: {
    fontSize: t.typography.sizes['6xl'],
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    marginBottom: t.spacing.sm,
  },
  waveformAdjuster: {
    position: 'relative',
  },
  frequencyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    height: 76,
  },
  waveformCompact: {
    height: 64,
  },
  sliderBlock: {
    width: '100%',
    gap: t.spacing.xs,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: t.spacing.xs,
  },
  quickPreset: {
    minHeight: 0,
    minWidth: 0,
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: t.spacing.xs,
    paddingVertical: t.spacing.sm,
  },
  actionDock: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
  },
  actionControlRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  actionOrnament: {
    width: iconSizes.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOrnamentImage: {
    width: '100%',
    height: iconSizes.xl,
  },
  actionDockCompact: {
    gap: t.spacing.xs,
    paddingVertical: t.spacing.sm,
  },
  safetyCue: {
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
  safetyText: {
    flexShrink: 1,
  },
}))
