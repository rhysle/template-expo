import {
  CheckCircleIcon,
  DeviceMobileSpeakerIcon,
  ShieldCheckIcon,
  SpeakerSlashIcon,
  WaveformIcon,
} from 'phosphor-react-native'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, View } from 'react-native'

import {
  AudioToolScreen,
  CircularAudioButton,
  EjectDurationPill,
  MascotHero,
} from '@/components/audio'
import { InlineNotice, ProgressRing, StatusBadge, Text } from '@/components/base'
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
  const { height } = useWindowDimensions()
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
  const formattedRemaining = formatDuration(remainingSeconds)
  const remainingText = t('audioTools.eject.remaining', { time: formattedRemaining })
  const remainingLabel = remainingText.replace(formattedRemaining, '').trim()
  const progress = isActive
    ? calculateProgress(snapshot.elapsedSeconds, durationSeconds)
    : resultState === 'completed'
      ? 1
      : 0
  const isCompactLayout = height < 900

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
    <AudioToolScreen variant="focused">
      <View style={styles.intro}>
        <StatusBadge
          label={status.label}
          tone={status.tone}
          icon={status.icon}
          style={styles.status}
        />
        <Text variant="body" tone="secondary" align="center">
          {t('audioTools.eject.subtitle')}
        </Text>
      </View>

      <View style={styles.primaryInteraction}>
        <View
          style={[
            styles.heroSlot,
            isCompactLayout && styles.heroSlotCompact,
            isActive && styles.heroSlotActive,
            isActive && isCompactLayout && styles.heroSlotActiveCompact,
          ]}>
          <MascotHero
            active={isActive}
            compact={isCompactLayout}
            showWaves={false}
            style={[
              styles.mascot,
              isCompactLayout && styles.mascotCompact,
              isActive && isCompactLayout && styles.mascotActiveCompact,
            ]}
          />
        </View>

        {isActive ? (
          <View
            accessibilityLabel={remainingText}
            accessibilityRole="timer"
            style={styles.remainingTime}>
            <Text variant="title" weight="bold" tone="accent" style={styles.timer}>
              {formattedRemaining}
            </Text>
            {remainingLabel ? (
              <Text variant="body" tone="secondary" align="center">
                {remainingLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.controlSection}>
          <View style={[styles.controlCluster, isCompactLayout && styles.controlClusterCompact]}>
            <View style={styles.mainControl}>
              {isActive ? (
                <ProgressRing
                  value={progress}
                  maximumValue={1}
                  size={isCompactLayout ? 156 : 168}
                  strokeWidth={6}
                  tone="error"
                  accessibilityLabel={status.label}
                  accessibilityValueText={remainingText}>
                  <CircularAudioButton
                    active
                    size="large"
                    haptic={hapticsEnabled}
                    accessibilityLabel={t('audioTools.eject.stop')}
                    onPress={handleMainPress}
                  />
                </ProgressRing>
              ) : (
                <CircularAudioButton
                  active={false}
                  size="large"
                  haptic={hapticsEnabled}
                  accessibilityLabel={t('audioTools.eject.start')}
                  onPress={handleMainPress}
                />
              )}
              <Text
                variant="subtitle"
                weight="semibold"
                tone={isActive ? 'error' : 'accent'}
                align="center">
                {isActive ? t('audioTools.eject.stop') : t('audioTools.eject.start')}
              </Text>
            </View>

            <EjectDurationPill disabled={isActive} style={styles.durationPill} />
          </View>

          <View style={styles.guidance}>
            <DeviceMobileSpeakerIcon
              size={iconSizes.md}
              color={theme.colors.text.secondary}
              weight="regular"
            />
            <Text variant="body" tone="secondary" align="center" style={styles.guidanceText}>
              {isActive
                ? t('audioTools.eject.runningHint')
                : resultState === 'completed'
                  ? t('audioTools.eject.completedHint')
                  : t('audioTools.eject.idleHint')}
            </Text>
          </View>
        </View>
      </View>

      {snapshot.outputRouteKind === 'external' ? (
        <InlineNotice
          title={t('audioTools.eject.externalTitle')}
          tone="warning"
          icon={SpeakerSlashIcon}>
          {t('audioTools.eject.externalBody')}
        </InlineNotice>
      ) : null}

      {snapshot.status === 'error' && isLastEjectSession ? (
        <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
      ) : null}
    </AudioToolScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  intro: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  status: {
    alignSelf: 'center',
  },
  primaryInteraction: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
  },
  heroSlot: {
    width: '100%',
    height: 336,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSlotCompact: {
    height: 244,
  },
  heroSlotActive: {
    height: 288,
  },
  heroSlotActiveCompact: {
    height: 208,
  },
  mascot: {
    transform: [{ scale: 1.32 }],
  },
  mascotCompact: {
    transform: [{ scale: 1.2 }],
  },
  mascotActiveCompact: {
    transform: [{ scale: 1.06 }],
  },
  controlSection: {
    width: '100%',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  remainingTime: {
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  timer: {
    fontSize: t.typography.sizes['6xl'],
    fontVariant: ['tabular-nums'],
  },
  controlCluster: {
    position: 'relative',
    width: '100%',
    minHeight: 196,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlClusterCompact: {
    minHeight: 184,
  },
  mainControl: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  durationPill: {
    position: 'absolute',
    top: t.spacing.sm,
    right: 0,
  },
  guidance: {
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
  },
  guidanceText: {
    flexShrink: 1,
  },
}))
