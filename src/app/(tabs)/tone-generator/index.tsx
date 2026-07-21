import { SlidersHorizontalIcon, SpeakerLowIcon, WaveformIcon } from 'phosphor-react-native'
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
  BottomSheet,
  ChoiceChip,
  InlineNotice,
  NativeSlider,
  Pressable,
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

const PRESETS = [165, 250, 440, 1_000, 8_000, 12_000] as const
const QUICK_PRESETS = PRESETS.slice(0, 4)

export default function ToneGeneratorScreen() {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const { height } = useWindowDimensions()
  const snapshot = useAudioController()
  const { hapticsEnabled, lastToneFrequencyHz, setLastToneFrequencyHz } = useAudioPreferencesState()
  const [frequencyHz, setFrequencyHz] = useState(lastToneFrequencyHz)
  const [isPresetSheetVisible, setIsPresetSheetVisible] = useState(false)
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

  const selectPreset = (preset: (typeof PRESETS)[number], dismissSheet = false) => {
    setFrequencyHz(preset)
    if (isRunning) audioController.setToneFrequency(preset)
    if (dismissSheet) setIsPresetSheetVisible(false)
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

  const actionDock = (
    <View style={[styles.actionDock, isCompactLayout && styles.actionDockCompact]}>
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
      <View style={styles.safetyCue}>
        <SpeakerLowIcon size={iconSizes.md} color={theme.colors.text.secondary} weight="regular" />
        <Text variant="caption" tone="secondary" align="center" style={styles.safetyText}>
          {t('audioTools.tone.volumeHint')}
        </Text>
      </View>
    </View>
  )

  return (
    <>
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
          compact
          showWaves={false}
          accentColor={waveformColor}
          style={isCompactLayout && styles.mascotCompact}
        />

        <View style={styles.frequencyBlock}>
          <Text variant="caption" tone="secondary" align="center">
            {t('audioTools.tone.currentFrequency')}
          </Text>
          <View style={styles.frequencyRow}>
            <Text
              variant="title"
              weight="bold"
              align="center"
              style={[styles.frequencyValue, { color: waveformColor }]}>
              {formattedFrequency}
            </Text>
            <Text variant="subtitle" weight="semibold" tone="secondary" style={styles.unit}>
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
              onLayout={handleWaveformLayout}
              style={styles.waveformAdjuster}>
              <FrequencyWaveform
                frequencyHz={frequencyHz}
                active={isRunning}
                color={waveformColor}
                accessibilityLabel={t('audioTools.tone.waveformLabel', {
                  frequency: formattedFrequency,
                })}
                style={[styles.waveform, isCompactLayout && styles.waveformCompact]}
              />
            </View>
          </GestureDetector>

          <View style={styles.sliderBlock}>
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
          </View>
        </View>

        <View style={styles.presetRow}>
          {QUICK_PRESETS.map((preset) => (
            <ChoiceChip
              key={preset}
              label={`${new Intl.NumberFormat().format(preset)} Hz`}
              selected={frequencyHz === preset}
              haptic={hapticsEnabled}
              onPress={() => selectPreset(preset)}
              style={styles.quickPreset}
            />
          ))}
          <Pressable
            accessibilityLabel={t('audioTools.tone.presets')}
            accessibilityRole="button"
            accessibilityState={{ expanded: isPresetSheetVisible }}
            haptic={hapticsEnabled}
            hapticType="selection"
            onPress={() => setIsPresetSheetVisible(true)}
            style={styles.presetsButton}>
            <SlidersHorizontalIcon
              size={iconSizes.sm}
              color={theme.colors.primary.main}
              weight="bold"
            />
            <Text
              variant="caption"
              weight="semibold"
              tone="accent"
              numberOfLines={1}
              style={styles.presetsButtonText}>
              {t('audioTools.tone.presets')}
            </Text>
          </Pressable>
        </View>

        {actionDock}

        {snapshot.status === 'error' && isLastToneSession ? (
          <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
        ) : null}
      </AudioToolScreen>

      <BottomSheet visible={isPresetSheetVisible} onDismiss={() => setIsPresetSheetVisible(false)}>
        <View style={styles.presetSheet}>
          <Text variant="title" weight="bold">
            {t('audioTools.tone.presets')}
          </Text>
          <View style={styles.presetSheetGrid}>
            {PRESETS.map((preset) => (
              <ChoiceChip
                key={preset}
                label={`${new Intl.NumberFormat().format(preset)} Hz`}
                selected={frequencyHz === preset}
                haptic={hapticsEnabled}
                onPress={() => selectPreset(preset, true)}
                style={styles.sheetPreset}
              />
            ))}
          </View>
        </View>
      </BottomSheet>
    </>
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
  mascotCompact: {
    transform: [{ scale: 0.86 }],
    marginVertical: -t.spacing.md,
  },
  frequencyBlock: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  frequencyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: t.spacing.xs,
  },
  frequencyValue: {
    fontSize: t.typography.sizes['6xl'],
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    marginBottom: t.spacing.xs,
  },
  waveformAdjuster: {
    width: '100%',
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
    minWidth: 0,
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: t.spacing.xs,
  },
  presetsButton: {
    minHeight: 44,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.soft,
  },
  presetsButtonText: {
    flexShrink: 1,
  },
  actionDock: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius['2xl'],
    backgroundColor: t.colors.background.surface,
    ...t.shadows.sm,
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
  presetSheet: {
    gap: t.spacing.lg,
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.xl,
  },
  presetSheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  sheetPreset: {
    minWidth: '30%',
    flexGrow: 1,
  },
}))
