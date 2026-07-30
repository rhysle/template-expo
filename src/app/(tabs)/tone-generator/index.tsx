import { Image } from 'expo-image'
import { SpeakerLowIcon, WaveformIcon } from 'phosphor-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  Platform,
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
  ToneWaveformPicker,
} from '@/components/audio'
import {
  ChoiceChip,
  InlineNotice,
  NativeSlider,
  Slider,
  StatusBadge,
  Text,
} from '@/components/base'
import { useRequestInterstitialAd } from '@/services/ads'
import {
  audioController,
  type FrequencyBand,
  frequencyFromNormalized,
  getFrequencyBand,
  normalizeFrequency,
  useAudioController,
  useAudioToolLifecycle,
} from '@/services/audio'
import { type PaywallSource, usePremiumGate } from '@/services/revenueCat'
import { useAppReview } from '@/services/storeReview'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

const FREQUENCY_PRESETS_HZ = [165, 250, 440, 1_000, 5_000] as const
const CENTER_FADE_INTENSITY = 0.3
const EDGE_FADE_INTENSITY = 1
const TONE_WAVEFORM_PAYWALL_SOURCE = 'tone_waveform' satisfies PaywallSource
const FrequencySlider = Platform.OS === 'ios' ? NativeSlider : Slider

export default function ToneGeneratorScreen() {
  const { i18n, t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const { height, width } = useWindowDimensions()
  const snapshot = useAudioController()
  const requestInterstitialAd = useRequestInterstitialAd()
  const { requestReview } = useAppReview()
  const { premiumState, requirePremium } = usePremiumGate()
  const {
    hapticsEnabled,
    lastToneFrequencyHz,
    lastToneWaveform,
    setLastToneFrequencyHz,
    setLastToneWaveform,
  } = useAudioPreferencesState()
  const [frequencyHz, setFrequencyHz] = useState(lastToneFrequencyHz)
  const activeWaveform = premiumState === 'premium' ? lastToneWaveform : 'sine'
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

  const bandLabels: Record<FrequencyBand, string> = {
    veryLow: t('audioTools.tone.band.veryLow'),
    low: t('audioTools.tone.band.low'),
    midLow: t('audioTools.tone.band.midLow'),
    mid: t('audioTools.tone.band.mid'),
    high: t('audioTools.tone.band.high'),
    veryHigh: t('audioTools.tone.band.veryHigh'),
  }
  useEffect(() => {
    currentPosition.value = normalizeFrequency(frequencyHz)
    const timer = setTimeout(() => setLastToneFrequencyHz(frequencyHz), 250)
    return () => clearTimeout(timer)
  }, [currentPosition, frequencyHz, setLastToneFrequencyHz])

  useEffect(() => {
    if (premiumState === 'free' && lastToneWaveform !== 'sine') {
      setLastToneWaveform('sine')
      if (isRunning) audioController.setToneWaveform('sine')
    }
  }, [isRunning, lastToneWaveform, premiumState, setLastToneWaveform])

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
    if (isRunning) audioController.setToneFrequency(nextFrequency)
  }

  const adjustFrequency = (direction: 'increment' | 'decrement') => {
    const multiplier = direction === 'increment' ? 1.1 : 1 / 1.1
    const nextFrequency = Math.min(Math.max(Math.round(frequencyHz * multiplier), 20), 20_000)
    currentPosition.value = normalizeFrequency(nextFrequency)
    setFrequencyHz(nextFrequency)
    if (isRunning) audioController.setToneFrequency(nextFrequency)
  }

  const selectFrequencyPreset = (frequency: (typeof FREQUENCY_PRESETS_HZ)[number]) => {
    currentPosition.value = normalizeFrequency(frequency)
    setFrequencyHz(frequency)
    if (isRunning) audioController.setToneFrequency(frequency)
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

  const handleMainPress = async () => {
    if (isActive) {
      const wasRunning = isRunning
      await audioController.stop('manual')
      if (wasRunning) {
        const didRequestReview = await requestReview()
        if (!didRequestReview) await requestInterstitialAd()
      }
    } else {
      void audioController.startTone(frequencyHz, activeWaveform)
    }
  }

  const handleWaveformChange = (waveform: typeof lastToneWaveform) => {
    const applyWaveform = () => {
      setLastToneWaveform(waveform)
      if (isRunning) audioController.setToneWaveform(waveform)
    }

    if (waveform === 'sine') applyWaveform()
    else requirePremium(TONE_WAVEFORM_PAYWALL_SOURCE, applyWaveform)
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
          onPress={() => void handleMainPress()}
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
      </View>

      <View style={styles.frequencyBlock}>
        <View style={styles.waveformContainer}>
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
                waveform={activeWaveform}
                active={isRunning}
                color={theme.colors.primary.main}
                accessibilityLabel={t('audioTools.tone.waveformLabel', {
                  frequency: formattedFrequency,
                  waveform: t(`audioTools.tone.waveform.${activeWaveform}`),
                })}
                centerFadeIntensity={CENTER_FADE_INTENSITY}
                edgeFadeIntensity={EDGE_FADE_INTENSITY}
              />
              <View pointerEvents="none" style={styles.frequencyOverlay}>
                <View style={styles.frequencyRow}>
                  <Text weight="bold" style={styles.frequencyValue}>
                    {formattedFrequency}
                  </Text>
                  <Text variant="subtitle" weight="semibold" tone="secondary" style={styles.unit}>
                    Hz
                  </Text>
                </View>
              </View>
            </View>
          </GestureDetector>
        </View>

        <View style={styles.sliderBlock}>
          <View style={styles.presetRow}>
            {FREQUENCY_PRESETS_HZ.map((presetFrequency) => (
              <ChoiceChip
                key={presetFrequency}
                label={t('audioTools.tone.frequencyValue', {
                  frequency: numberFormatter.format(presetFrequency),
                })}
                selected={frequencyHz === presetFrequency}
                haptic={hapticsEnabled}
                hitSlop={{ top: theme.spacing.xs, bottom: theme.spacing.xs }}
                onPress={() => selectFrequencyPreset(presetFrequency)}
                style={[
                  styles.frequencyPreset,
                  frequencyHz !== presetFrequency && styles.frequencyPresetUnselected,
                ]}
              />
            ))}
          </View>
          <FrequencySlider
            min={0}
            max={1}
            value={normalizeFrequency(frequencyHz)}
            onValueChange={applyFrequencyPosition}
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

      <ToneWaveformPicker
        value={activeWaveform}
        disabled={isStarting}
        haptic={hapticsEnabled}
        premiumLocked={premiumState !== 'premium'}
        onValueChange={handleWaveformChange}
      />

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
  frequencyBlock: {
    minHeight: 0,
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: t.spacing.lg,
  },
  frequencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: t.spacing.xs,
  },
  frequencyValue: {
    color: t.colors.primary.main,
    fontSize: t.typography.sizes['8xl'],
    fontVariant: ['tabular-nums'],
    textShadowColor: t.colors.text.inverse,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  unit: {
    marginBottom: t.spacing.sm,
  },
  waveformContainer: {
    flex: 1,
    justifyContent: 'center',
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
  sliderBlock: {
    width: '100%',
    gap: t.spacing.xs,
  },
  presetRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: t.spacing.xs,
    paddingVertical: t.spacing.md,
  },
  frequencyPreset: {
    minHeight: 36,
    minWidth: 0,
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: t.spacing.xs,
    paddingVertical: t.spacing.xs,
  },
  frequencyPresetUnselected: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
