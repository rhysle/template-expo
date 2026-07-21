import { WaveformIcon } from 'phosphor-react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, View } from 'react-native'

import { AudioToolScreen, CircularAudioButton, StereoStage } from '@/components/audio'
import { InlineNotice, NativeToggle, Text } from '@/components/base'
import { audioController, useAudioController, useAudioToolLifecycle } from '@/services/audio'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

const AUTO_ALTERNATE_INTERVAL_MS = 1_500
const AUTO_PANS = [-1, 1, 0] as const

interface ChannelSelection {
  left: boolean
  right: boolean
}

const channelsForPan = (pan: number): ChannelSelection => {
  if (pan < -0.25) return { left: true, right: false }
  if (pan > 0.25) return { left: false, right: true }
  return { left: true, right: true }
}

const panForChannels = ({ left, right }: ChannelSelection): number => {
  if (left && !right) return -1
  if (!left && right) return 1
  return 0
}

export default function StereoTestScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const { height } = useWindowDimensions()
  const snapshot = useAudioController()
  const { hapticsEnabled } = useAudioPreferencesState()
  const [selection, setSelection] = useState<ChannelSelection>({ left: false, right: false })
  const [autoAlternate, setAutoAlternate] = useState(false)
  const [autoStep, setAutoStep] = useState(0)
  const wasActive = useRef(false)
  useAudioToolLifecycle()

  const isRunning = snapshot.activeTool === 'stereo' && snapshot.status === 'running'
  const isStarting = snapshot.activeTool === 'stereo' && snapshot.status === 'starting'
  const isActive = isRunning || isStarting
  const isLastStereoSession = snapshot.lastTool === 'stereo'
  const isCompactLayout = height < 900
  const playbackChannels = isActive ? channelsForPan(snapshot.stereoPan) : selection
  const leftActive = isActive && playbackChannels.left
  const rightActive = isActive && playbackChannels.right

  useEffect(() => {
    if (!autoAlternate || !isRunning) return

    const interval = setInterval(() => {
      setAutoStep((step) => (step + 1) % AUTO_PANS.length)
    }, AUTO_ALTERNATE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [autoAlternate, isRunning])

  useEffect(() => {
    if (autoAlternate && isRunning) audioController.setStereoPan(AUTO_PANS[autoStep])
  }, [autoAlternate, autoStep, isRunning])

  useEffect(() => {
    if (wasActive.current && !isActive) {
      setSelection({ left: false, right: false })
      setAutoStep(0)
    }
    wasActive.current = isActive
  }, [isActive])

  const playChannels = (nextSelection: ChannelSelection) => {
    setSelection(nextSelection)
    if (!nextSelection.left && !nextSelection.right) {
      void audioController.stop('manual')
      return
    }

    const pan = panForChannels(nextSelection)
    if (isActive) audioController.setStereoPan(pan)
    else void audioController.startStereoManual(pan)
  }

  const toggleChannel = (channel: keyof ChannelSelection) => {
    const currentSelection = autoAlternate && isActive ? playbackChannels : selection
    const nextSelection = { ...currentSelection, [channel]: !currentSelection[channel] }
    setAutoAlternate(false)
    setAutoStep(0)
    playChannels(nextSelection)
  }

  const toggleAutoAlternate = (value: boolean) => {
    setAutoAlternate(value)
    setAutoStep(0)

    if (!isActive) return
    if (value) {
      setSelection({ left: true, right: true })
      audioController.setStereoPan(AUTO_PANS[0])
      return
    }

    const currentSelection = channelsForPan(snapshot.stereoPan)
    setSelection(currentSelection)
  }

  const stop = () => {
    setSelection({ left: false, right: false })
    setAutoStep(0)
    void audioController.stop('manual')
  }

  const start = () => {
    if (autoAlternate) {
      setSelection({ left: true, right: true })
      setAutoStep(0)
      void audioController.startStereoManual(AUTO_PANS[0])
      return
    }

    const nextSelection =
      selection.left || selection.right ? selection : { left: true, right: true }
    playChannels(nextSelection)
  }

  const statusLabel = !isActive
    ? t('audioTools.stereo.idlePosition')
    : leftActive && rightActive
      ? t('audioTools.stereo.positionCenter')
      : leftActive
        ? t('audioTools.stereo.positionLeft')
        : t('audioTools.stereo.positionRight')

  return (
    <AudioToolScreen
      variant="focused"
      contentStyle={[styles.content, isCompactLayout && styles.contentCompact]}>
      <View style={styles.status}>
        <WaveformIcon
          size={iconSizes.md}
          color={isActive ? colors.primary.main : colors.text.muted}
          weight="bold"
        />
        <Text variant="body" weight="semibold" tone={isActive ? 'accent' : 'muted'} align="center">
          {statusLabel}
        </Text>
      </View>

      <StereoStage
        leftActive={leftActive}
        rightActive={rightActive}
        playing={isRunning}
        compact={isCompactLayout}
        leftLabel={t('audioTools.stereo.left')}
        rightLabel={t('audioTools.stereo.right')}
        onToggleLeft={() => toggleChannel('left')}
        onToggleRight={() => toggleChannel('right')}
        haptic={hapticsEnabled}
      />

      <Text variant="body" tone="secondary" align="center" style={styles.helperText}>
        {t('audioTools.stereo.tapToChange')}
      </Text>

      <View style={styles.controls}>
        <View style={styles.autoRow}>
          <View style={styles.autoCopy}>
            <Text variant="body" weight="semibold">
              {t('audioTools.stereo.auto')}
            </Text>
            <Text variant="caption" tone="muted">
              {t('audioTools.stereo.autoHint')}
            </Text>
          </View>
          <NativeToggle
            value={autoAlternate}
            onValueChange={toggleAutoAlternate}
            style={styles.nativeToggle}
            testID="stereo-auto-alternate-toggle"
          />
        </View>

        <View style={styles.transport}>
          <CircularAudioButton
            active={isActive}
            loading={isStarting}
            haptic={hapticsEnabled}
            accessibilityLabel={
              isActive ? t('audioTools.stereo.stop') : t('audioTools.stereo.start')
            }
            onPress={isActive ? stop : start}
          />
          <Text
            variant="subtitle"
            weight="semibold"
            tone={isActive ? 'error' : 'accent'}
            align="center">
            {isActive ? t('audioTools.stereo.stop') : t('audioTools.stereo.start')}
          </Text>
        </View>
      </View>

      {snapshot.status === 'error' && isLastStereoSession ? (
        <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
      ) : null}
    </AudioToolScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  content: {
    gap: t.spacing.md,
    justifyContent: 'flex-start',
  },
  contentCompact: {
    gap: t.spacing.sm,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: t.spacing.sm,
  },
  helperText: {
    marginTop: -t.spacing.xs,
  },
  controls: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: t.spacing.md,
  },
  autoRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.xl,
    backgroundColor: t.colors.background.subtle,
  },
  autoCopy: {
    flex: 1,
    gap: t.spacing.xs,
  },
  nativeToggle: {
    width: 56,
    height: 36,
  },
  transport: {
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingTop: t.spacing.xs,
  },
}))
