import {
  LockKeyIcon,
  MicrophoneIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from 'phosphor-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, useWindowDimensions, View } from 'react-native'

import { AudioToolScreen, CircularAudioButton, DbMeterGauge, MascotHero } from '@/components/audio'
import { InlineNotice, PermissionSheet, Pressable, StatusBadge, Text } from '@/components/base'
import { usePreventInterstitialAd, useRequestInterstitialAd } from '@/services/ads'
import {
  audioController,
  classifyMeterBand,
  type MeterBand,
  useAudioController,
  useAudioToolLifecycle,
} from '@/services/audio'
import { type PaywallSource, usePremiumGate } from '@/services/revenueCat'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

const DB_STATS_PAYWALL_SOURCE = 'db_stats' satisfies PaywallSource

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
  usePreventInterstitialAd('db_meter_permission', isCheckingPermission || permissionSheetVisible)
  useAudioToolLifecycle()

  const isRunning = snapshot.activeTool === 'meter' && snapshot.status === 'running'
  const isStarting = snapshot.activeTool === 'meter' && snapshot.status === 'starting'
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

  const getStatColor = (value: number) => bandColors[classifyMeterBand(value)]

  const handleMainPress = async () => {
    if (isActive) {
      const wasRunning = isRunning
      await audioController.stop('manual')
      if (wasRunning) await requestInterstitialAd()
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
        showWaves={false}
        accentColor={statusColor}
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

      <Pressable
        accessibilityRole={premiumState === 'premium' ? undefined : 'button'}
        accessibilityLabel={
          premiumState === 'premium' ? undefined : t('audioTools.meter.unlockStats')
        }
        accessibilityHint={premiumState === 'premium' ? undefined : t('premium.lockedHint')}
        disabled={premiumState === 'premium'}
        haptic={premiumState !== 'premium'}
        onPress={() =>
          requirePremium(DB_STATS_PAYWALL_SOURCE, () => {
            // Values are already rendered when Premium is active.
          })
        }>
        <View style={styles.statsRow}>
          {[
            { label: t('audioTools.meter.minimum'), value: meter.minimumDb },
            { label: t('audioTools.meter.average'), value: meter.averageDb },
            { label: t('audioTools.meter.maximum'), value: meter.maximumDb },
          ].map((stat, index) => (
            <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivider]}>
              <Text variant="caption" tone="secondary" align="center">
                {stat.label}
              </Text>
              {premiumState === 'premium' ? (
                <Text
                  variant="subtitle"
                  weight="bold"
                  align="center"
                  style={[styles.statValue, { color: getStatColor(stat.value) }]}>
                  {Math.round(stat.value)} dB
                </Text>
              ) : (
                <View style={styles.lockedStatValue}>
                  <LockKeyIcon size={iconSizes.sm} color={theme.colors.text.muted} weight="fill" />
                  <Text
                    variant="subtitle"
                    weight="bold"
                    align="center"
                    style={[styles.statValue, { color: theme.colors.text.muted }]}>
                    dB
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </Pressable>

      <View style={[styles.controls, isCompactLayout && styles.controlsCompact]}>
        <CircularAudioButton
          active={isActive}
          loading={isCheckingPermission}
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
  statsRow: {
    flexDirection: 'row',
    marginTop: t.spacing.md,
    paddingVertical: t.spacing.sm,
  },
  stat: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: t.colors.border.subtle,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
  lockedStatValue: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
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
