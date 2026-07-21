import {
  CheckCircleIcon,
  DropIcon,
  ShieldCheckIcon,
  SpeakerSlashIcon,
  WaveformIcon,
} from 'phosphor-react-native'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { AudioToolScreen, CircularAudioButton, MascotHero } from '@/components/audio'
import { Card, InlineNotice, ProgressRing, StatusBadge, Text } from '@/components/base'
import {
  audioController,
  calculateProgress,
  getAudioResultState,
  useAudioController,
  useAudioToolLifecycle,
} from '@/services/audio'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'
import { haptics } from '@/utils/haptics'

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(Math.ceil(seconds), 0)
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(
    safeSeconds % 60
  ).padStart(2, '0')}`
}

export default function EjectScreen() {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const snapshot = useAudioController()
  const { ejectDurationSeconds, hapticsEnabled } = useAudioPreferencesState()
  const celebratedRef = useRef(false)
  useAudioToolLifecycle()

  const isRunning = snapshot.activeTool === 'eject' && snapshot.status === 'running'
  const isStarting = snapshot.activeTool === 'eject' && snapshot.status === 'starting'
  const isActive = isRunning || isStarting
  const isLastEjectSession = snapshot.lastTool === 'eject'
  const resultState = getAudioResultState(isLastEjectSession ? snapshot.stopReason : null)
  const durationSeconds = snapshot.durationSeconds ?? ejectDurationSeconds
  const remainingSeconds = Math.max(durationSeconds - snapshot.elapsedSeconds, 0)
  const progress = isActive
    ? calculateProgress(snapshot.elapsedSeconds, durationSeconds)
    : resultState === 'completed'
      ? 1
      : 0

  useEffect(() => {
    void audioController.refreshOutputRoute()
  }, [])

  useEffect(() => {
    if (resultState === 'completed' && !celebratedRef.current) {
      celebratedRef.current = true
      if (hapticsEnabled) void haptics.medium()
    } else if (resultState !== 'completed') {
      celebratedRef.current = false
    }
  }, [hapticsEnabled, resultState])

  const handleMainPress = () => {
    if (isActive) {
      void audioController.stop('manual')
    } else {
      void audioController.startEject(ejectDurationSeconds)
    }
  }

  const status = isActive
    ? { label: t('audioTools.eject.running'), tone: 'accent' as const, icon: WaveformIcon }
    : resultState === 'completed'
      ? {
          label: t('audioTools.eject.completed'),
          tone: 'success' as const,
          icon: CheckCircleIcon,
        }
      : { label: t('audioTools.eject.safe'), tone: 'success' as const, icon: ShieldCheckIcon }

  return (
    <AudioToolScreen>
      <View style={styles.intro}>
        <Text variant="body" tone="secondary" align="center">
          {t('audioTools.eject.subtitle')}
        </Text>
        <StatusBadge label={status.label} tone={status.tone} icon={status.icon} />
      </View>

      <MascotHero active={isRunning} />

      <View style={styles.controlSection}>
        <ProgressRing
          value={progress}
          maximumValue={1}
          size={178}
          strokeWidth={12}
          accessibilityLabel={status.label}
          accessibilityValueText={
            isActive
              ? t('audioTools.eject.remaining', { time: formatDuration(remainingSeconds) })
              : status.label
          }>
          <View style={styles.progressContent}>
            <Text variant="title" weight="bold" tone="accent" style={styles.timer}>
              {isActive ? formatDuration(remainingSeconds) : formatDuration(durationSeconds)}
            </Text>
            <Text variant="caption" tone="secondary" align="center">
              {isActive
                ? t('audioTools.eject.running')
                : resultState === 'completed'
                  ? t('audioTools.eject.completed')
                  : t('audioTools.eject.safe')}
            </Text>
          </View>
        </ProgressRing>

        <CircularAudioButton
          active={isActive}
          loading={isStarting || snapshot.status === 'stopping'}
          haptic={hapticsEnabled}
          accessibilityLabel={isActive ? t('audioTools.eject.stop') : t('audioTools.eject.start')}
          onPress={handleMainPress}
        />
        <Text variant="subtitle" weight="semibold" tone="accent" align="center">
          {isActive ? t('audioTools.eject.stop') : t('audioTools.eject.start')}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {isActive
            ? t('audioTools.eject.runningHint')
            : resultState === 'completed'
              ? t('audioTools.eject.completedHint')
              : t('audioTools.eject.idleHint')}
        </Text>
      </View>

      {snapshot.outputRouteKind === 'external' ? (
        <InlineNotice
          title={t('audioTools.eject.externalTitle')}
          tone="warning"
          icon={SpeakerSlashIcon}>
          {t('audioTools.eject.externalBody')}
        </InlineNotice>
      ) : null}

      {resultState === 'interrupted' ? (
        <InlineNotice tone="warning">{t('audioTools.common.interrupted')}</InlineNotice>
      ) : null}

      {snapshot.status === 'error' && isLastEjectSession ? (
        <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
      ) : null}

      <Card style={styles.howCard}>
        <View style={styles.howIcon}>
          <DropIcon size={iconSizes.lg} color={theme.colors.primary.main} weight="fill" />
        </View>
        <View style={styles.howContent}>
          <Text variant="subtitle" weight="semibold" tone="accent">
            {t('audioTools.eject.howTitle')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('audioTools.eject.howBody')}
          </Text>
        </View>
      </Card>

      <InlineNotice compact>{t('audioTools.common.gradualVolume')}</InlineNotice>
    </AudioToolScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  intro: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  controlSection: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  progressContent: {
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.lg,
  },
  timer: {
    fontVariant: ['tabular-nums'],
  },
  howCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  howIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.soft,
  },
  howContent: {
    minWidth: 0,
    flex: 1,
    gap: t.spacing.xs,
  },
}))
