import { EarIcon, ShieldCheckIcon, WarningCircleIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { Linking, View } from 'react-native'

import { AudioToolScreen, CircularAudioButton, DbMeterGauge, MascotHero } from '@/components/audio'
import { Button, Card, InlineNotice, StatusBadge, Text } from '@/components/base'
import {
  audioController,
  type MeterBand,
  useAudioController,
  useAudioToolLifecycle,
} from '@/services/audio'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

export default function DbMeterScreen() {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const snapshot = useAudioController()
  const { hapticsEnabled, meterCalibrationOffsetDb, meterResponse } = useAudioPreferencesState()
  useAudioToolLifecycle()

  const isRunning = snapshot.activeTool === 'meter' && snapshot.status === 'running'
  const isStarting = snapshot.activeTool === 'meter' && snapshot.status === 'starting'
  const isActive = isRunning || isStarting
  const isLastMeterSession = snapshot.lastTool === 'meter'
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
  const statusGuidance: Record<MeterBand, string> = {
    veryQuiet: t('audioTools.meter.guidance.veryQuiet'),
    normal: t('audioTools.meter.guidance.normal'),
    loud: t('audioTools.meter.guidance.loud'),
    danger: t('audioTools.meter.guidance.danger'),
  }
  const statusColor = bandColors[meter.band]
  const statusTone = bandTones[meter.band]

  const handleMainPress = async () => {
    if (isActive) {
      await audioController.stop('manual')
      return
    }

    await audioController.startMeter({
      calibrationOffsetDb: meterCalibrationOffsetDb,
      response: meterResponse,
    })
  }

  return (
    <AudioToolScreen>
      <View style={styles.intro}>
        <Text variant="body" tone="secondary" align="center">
          {t('audioTools.meter.subtitle')}
        </Text>
        <StatusBadge label={t('audioTools.meter.protect')} tone="success" icon={ShieldCheckIcon} />
      </View>

      <MascotHero active={isRunning} compact accentColor={statusColor} />

      <Card style={styles.meterCard}>
        <Text variant="caption" tone="secondary" align="center">
          {t('audioTools.meter.estimated')}
        </Text>
        <View style={styles.readingRow}>
          <Text
            variant="title"
            weight="bold"
            style={[styles.reading, { color: statusColor }]}
            accessibilityLiveRegion="polite">
            {roundedDb}
          </Text>
          <Text variant="subtitle" weight="semibold" style={{ color: statusColor }}>
            dB
          </Text>
        </View>

        <DbMeterGauge
          value={meter.currentDb}
          indicatorColor={statusColor}
          accessibilityLabel={`${t('audioTools.meter.estimated')}: ${roundedDb} dB`}
        />

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

        <InlineNotice compact tone={statusTone} icon={EarIcon}>
          {statusGuidance[meter.band]}
        </InlineNotice>
      </Card>

      <View style={styles.statsRow}>
        {[
          { label: t('audioTools.meter.minimum'), value: meter.minimumDb },
          { label: t('audioTools.meter.average'), value: meter.averageDb },
          { label: t('audioTools.meter.maximum'), value: meter.maximumDb },
        ].map((stat) => (
          <Card key={stat.label} variant="subtle" padding="md" style={styles.statCard}>
            <Text variant="caption" tone="secondary" align="center">
              {stat.label}
            </Text>
            <Text variant="subtitle" weight="bold" align="center" style={styles.statValue}>
              {Math.round(stat.value)} dB
            </Text>
          </Card>
        ))}
      </View>

      <View style={styles.controls}>
        <CircularAudioButton
          active={isActive}
          haptic={hapticsEnabled}
          accessibilityLabel={isActive ? t('audioTools.meter.stop') : t('audioTools.meter.start')}
          onPress={() => void handleMainPress()}
        />
        <Text variant="subtitle" weight="semibold" tone="accent" align="center">
          {isActive ? t('audioTools.meter.stop') : t('audioTools.meter.start')}
        </Text>
        <Button
          variant="secondary"
          label={t('audioTools.meter.reset')}
          haptic={hapticsEnabled}
          disabled={meter.sampleCount === 0}
          onPress={audioController.resetMeterStats}
        />
      </View>

      {snapshot.microphonePermission === 'Denied' ? (
        <InlineNotice
          title={t('audioTools.meter.permissionTitle')}
          tone="warning"
          action={{
            label: t('common.openSettings'),
            onPress: () => void Linking.openSettings(),
          }}>
          {t('audioTools.meter.permissionBody')}
        </InlineNotice>
      ) : null}

      {snapshot.status === 'error' && isLastMeterSession ? (
        <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
      ) : null}

      <InlineNotice title={t('audioTools.meter.privacyTitle')} tone="info">
        {t('audioTools.meter.privacyBody')}
      </InlineNotice>
      <Text variant="caption" tone="muted" align="center">
        {t('audioTools.meter.disclaimer')}
      </Text>
    </AudioToolScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  intro: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  meterCard: {
    alignItems: 'center',
    gap: t.spacing.lg,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: t.spacing.xs,
  },
  reading: {
    fontSize: t.typography.sizes['6xl'],
    fontVariant: ['tabular-nums'],
  },
  statusBlock: {
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  statCard: {
    minWidth: 0,
    flex: 1,
    gap: t.spacing.xs,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
  controls: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
}))
