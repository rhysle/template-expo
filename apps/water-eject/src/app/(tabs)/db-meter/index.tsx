import { MicrophoneIcon, ShieldCheckIcon, WarningCircleIcon } from 'phosphor-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, useWindowDimensions, View } from 'react-native'

import {
  AudioToolScreen,
  CircularAudioButton,
  DbMeterGauge,
  DbSessionSheet,
  DbStatsReport,
  MascotHero,
} from '@/components/audio'
import { InlineNotice, PermissionSheet, StatusBadge, Text } from '@/components/base'
import { type DbActivityRecord, getActivitySnapshot } from '@/services/activity'
import { usePreventInterstitialAd, useRequestInterstitialAd } from '@/services/ads'
import {
  audioController,
  type MeterBand,
  useAudioController,
  useAudioToolLifecycle,
} from '@/services/audio'
import { type PaywallSource, usePremiumGate } from '@/services/revenueCat'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

const DB_INSIGHTS_PAYWALL_SOURCE = 'db_advanced' satisfies PaywallSource
const MASCOT_SOURCES: Record<MeterBand, number> = {
  veryQuiet: require('@/assets/images/mascot/db-very-quiet.png'),
  normal: require('@/assets/images/mascot/db-normal.png'),
  loud: require('@/assets/images/mascot/db-loud.png'),
  danger: require('@/assets/images/mascot/db-danger.png'),
}

export default function DbMeterScreen() {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const { height } = useWindowDimensions()
  const snapshot = useAudioController()
  const requestInterstitialAd = useRequestInterstitialAd()
  const { premiumState, requirePremium } = usePremiumGate()
  const { hapticsEnabled } = useAudioPreferencesState()
  const [permissionSheetVisible, setPermissionSheetVisible] = useState(false)
  const [isCheckingPermission, setIsCheckingPermission] = useState(false)
  const [completedSession, setCompletedSession] = useState<DbActivityRecord | null>(null)
  usePreventInterstitialAd('db_meter_permission', isCheckingPermission || permissionSheetVisible)
  useAudioToolLifecycle()

  const isRunning = snapshot.activeTool === 'meter' && snapshot.status === 'running'
  const isStarting = snapshot.activeTool === 'meter' && snapshot.status === 'starting'
  const isStopping = snapshot.activeTool === 'meter' && snapshot.status === 'stopping'
  const isActive = isRunning || isStarting
  const isLastMeterSession = snapshot.lastTool === 'meter'
  const isCompactLayout = height < 900
  const meter = snapshot.meter
  const roundedDb = Math.round(meter.currentDb)

  const bandColors: Record<MeterBand, string> = {
    veryQuiet: theme.colors.primary.main,
    normal: theme.colors.status.success,
    loud: theme.colors.status.warning,
    danger: theme.colors.status.error,
  }
  const bandTones = {
    veryQuiet: 'info',
    normal: 'success',
    loud: 'warning',
    danger: 'error',
  } as const
  const statusLabels: Record<MeterBand, string> = {
    veryQuiet: t('audioTools.meter.status.veryQuiet'),
    normal: t('audioTools.meter.status.normal'),
    loud: t('audioTools.meter.status.loud'),
    danger: t('audioTools.meter.status.danger'),
  }
  const statusDescriptions: Record<MeterBand, string> = {
    veryQuiet: t('audioTools.meter.description.veryQuiet'),
    normal: t('audioTools.meter.description.normal'),
    loud: t('audioTools.meter.description.loud'),
    danger: t('audioTools.meter.description.danger'),
  }
  const statusColor = bandColors[meter.band]
  const statusTone = bandTones[meter.band]
  const readingColor = statusColor

  const handleMainPress = async () => {
    if (isStopping) return

    if (isActive) {
      const wasRunning = isRunning
      const previousLatestSessionId = getActivitySnapshot().db[0]?.id
      await audioController.stop('manual')
      if (wasRunning) {
        const latestSession = getActivitySnapshot().db[0]
        await requestInterstitialAd()
        if (latestSession && latestSession.id !== previousLatestSessionId) {
          setCompletedSession(latestSession)
        }
      }
      return
    }

    if (isCheckingPermission) return

    setIsCheckingPermission(true)
    try {
      const wasDenied = snapshot.microphonePermission === 'Denied'
      const permission = await audioController.checkMicrophonePermission()

      if (permission === 'Denied' || (wasDenied && permission !== 'Granted')) {
        setPermissionSheetVisible(true)
        return
      }

      await audioController.startMeter()
    } finally {
      setIsCheckingPermission(false)
    }
  }

  const handleOpenSettings = () => {
    setPermissionSheetVisible(false)
    void Linking.openSettings()
  }

  return (
    <AudioToolScreen
      variant="focused"
      contentStyle={[styles.content, isCompactLayout && styles.contentCompact]}>
      <MascotHero
        active={isRunning}
        compact={isCompactLayout}
        fillAvailableSpace
        source={MASCOT_SOURCES[meter.band]}
        style={styles.mascot}
      />

      <View style={styles.meterBlock}>
        <View style={styles.readingRow}>
          <Text variant="subtitle" weight="semibold" style={{ opacity: 0, color: readingColor }}>
            dB
          </Text>
          <Text
            variant="title"
            weight="bold"
            style={[styles.reading, { color: readingColor }]}
            accessibilityLiveRegion="polite">
            {roundedDb}
          </Text>
          <Text variant="subtitle" weight="semibold" style={{ color: readingColor }}>
            dB
          </Text>
        </View>

        <View style={styles.statusBlock}>
          <StatusBadge
            label={statusLabels[meter.band]}
            tone={statusTone}
            icon={
              meter.band === 'danger' || meter.band === 'loud' ? WarningCircleIcon : ShieldCheckIcon
            }
          />
          <Text variant="caption" tone="secondary" align="center">
            {statusDescriptions[meter.band]}
          </Text>
        </View>

        <DbMeterGauge
          value={meter.currentDb}
          indicatorColor={readingColor}
          accessibilityLabel={`${t('audioTools.meter.estimated')}: ${roundedDb} dB`}
          style={styles.gauge}
        />
      </View>

      <View style={styles.statsRowContainer}>
        <DbStatsReport
          minimumDb={meter.minimumDb}
          averageDb={meter.averageDb}
          maximumDb={meter.maximumDb}
          style={styles.statsReport}
        />
      </View>

      <View style={[styles.controls, isCompactLayout && styles.controlsCompact]}>
        <CircularAudioButton
          active={isActive}
          loading={isCheckingPermission || isStopping}
          disabled={isStopping}
          haptic={hapticsEnabled}
          accessibilityLabel={isActive ? t('audioTools.meter.stop') : t('audioTools.meter.start')}
          onPress={() => void handleMainPress()}
        />
        <Text
          variant="subtitle"
          weight="semibold"
          align="center"
          style={{ color: isActive ? theme.colors.status.error : theme.colors.primary.main }}>
          {isActive ? t('audioTools.meter.stop') : t('audioTools.meter.start')}
        </Text>
      </View>

      {snapshot.status === 'error' && isLastMeterSession ? (
        <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
      ) : null}

      <PermissionSheet
        visible={permissionSheetVisible}
        icon={MicrophoneIcon}
        title={t('audioTools.meter.permissionTitle')}
        description={t('audioTools.meter.permissionBody')}
        actionLabel={t('common.openSettings')}
        onAction={handleOpenSettings}
        onDismiss={() => setPermissionSheetVisible(false)}
      />

      <DbSessionSheet
        visible={completedSession !== null}
        record={completedSession}
        premiumState={premiumState}
        onUpgrade={() =>
          requirePremium(DB_INSIGHTS_PAYWALL_SOURCE, () => {
            // The report updates automatically when Premium becomes active.
          })
        }
        onDismiss={() => setCompletedSession(null)}
      />
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
  mascot: {
    minHeight: 0,
    width: '100%',
  },
  meterBlock: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: t.spacing.xs,
  },
  reading: {
    fontSize: t.typography.sizes['6xl'],
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  statusBlock: {
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  gauge: {
    marginTop: t.spacing.sm,
  },
  statsRowContainer: {
    opacity: 1,
  },
  statsReport: {
    marginTop: t.spacing.md,
  },
  controls: {
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: t.spacing.md,
    paddingTop: t.spacing.sm,
  },
  controlsCompact: {
    paddingTop: 0,
  },
}))
