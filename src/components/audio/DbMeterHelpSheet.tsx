import { LinearGradient } from 'expo-linear-gradient'
import { HeadphonesIcon, MapPinIcon, MicrophoneIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Button, NativeBottomSheet, Text } from '@/components/base'
import { classifyMeterBand, type MeterBand } from '@/services/audio'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

const EXPOSURE_LEVELS = [
  { level: 85, hours: 8 },
  { level: 88, hours: 4 },
  { level: 91, hours: 2 },
  { level: 94, hours: 1 },
] as const

const CHART_HEIGHT = 448
const CHART_INSET = 24

interface DbMeterHelpSheetProps {
  visible: boolean
  currentDb: number | null
  onDismiss: () => void
}

export const DbMeterHelpSheet = ({ visible, currentDb, onDismiss }: DbMeterHelpSheetProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const steps = [
    t('audioTools.meter.help.stepPlace'),
    t('audioTools.meter.help.stepUncovered'),
    t('audioTools.meter.help.stepStart'),
  ]
  const referenceLevels = [
    { value: 110, label: t('audioTools.meter.help.reference.concertSpeaker') },
    { value: 95, label: t('audioTools.meter.help.reference.sirenNightclub') },
    { value: 85, label: t('audioTools.meter.help.reference.lawnMower') },
    { value: 70, label: t('audioTools.meter.help.reference.busyStreet') },
    { value: 60, label: t('audioTools.meter.help.reference.conversation') },
    { value: 50, label: t('audioTools.meter.help.reference.quietHome') },
    { value: 30, label: t('audioTools.meter.help.reference.whisper') },
    { value: 20, label: t('audioTools.meter.help.reference.hearingThreshold') },
  ]
  const bandLabels: Record<MeterBand, string> = {
    veryQuiet: t('audioTools.meter.status.veryQuiet'),
    normal: t('audioTools.meter.status.normal'),
    loud: t('audioTools.meter.status.loud'),
    danger: t('audioTools.meter.status.danger'),
  }
  const bandColors: Record<MeterBand, string> = {
    veryQuiet: theme.colors.primary.main,
    normal: theme.colors.status.success,
    loud: theme.colors.status.warning,
    danger: theme.colors.status.error,
  }
  const currentBand = currentDb === null ? null : classifyMeterBand(currentDb)
  const chartRows: {
    value: number
    label: string
    current: boolean
    categoryLabel?: string
  }[] = referenceLevels
    .filter(({ value }) => currentDb === null || Math.abs(value - currentDb) > 2)
    .map(({ value, label }) => ({ value, label, current: false }))
  if (currentDb !== null && currentBand !== null) {
    chartRows.push({
      value: currentDb,
      label: t('audioTools.meter.help.currentEstimate'),
      current: true,
      categoryLabel: bandLabels[currentBand],
    })
    chartRows.sort((first, second) => second.value - first.value)
  }
  const tips = [
    {
      icon: MicrophoneIcon,
      title: t('audioTools.meter.help.tipMicrophoneTitle'),
      body: t('audioTools.meter.help.tipMicrophoneBody'),
    },
    {
      icon: MapPinIcon,
      title: t('audioTools.meter.help.tipPositionTitle'),
      body: t('audioTools.meter.help.tipPositionBody'),
    },
    {
      icon: HeadphonesIcon,
      title: t('audioTools.meter.help.tipProtectTitle'),
      body: t('audioTools.meter.help.tipProtectBody'),
    },
  ]

  return (
    <NativeBottomSheet
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['96%']}
      scrollable
      contentContainerStyle={styles.sheetContent}
      scrollHeader={
        <View pointerEvents="none" style={styles.sheetHeader}>
          <View style={styles.headerMaterial}>
            <Text variant="title" weight="bold" align="center" style={styles.sheetTitle}>
              {t('audioTools.meter.help.title')}
            </Text>
          </View>
          <LinearGradient
            colors={[
              theme.colors.background.surface,
              withAlpha(theme.colors.background.surface, 0.72),
              withAlpha(theme.colors.background.surface, 0),
            ]}
            locations={[0, 0.42, 1]}
            style={styles.headerFade}
          />
        </View>
      }
      scrollFooter={
        <View style={styles.sheetFooter}>
          <LinearGradient
            pointerEvents="none"
            colors={[
              withAlpha(theme.colors.background.surface, 0),
              withAlpha(theme.colors.background.surface, 0.72),
              theme.colors.background.surface,
            ]}
            locations={[0, 0.58, 1]}
            style={styles.footerFade}
          />
          <View style={styles.footerMaterial}>
            <Button label={t('common.done')} fullWidth onPress={onDismiss} />
          </View>
        </View>
      }>
      <View style={styles.section}>
        <Text variant="subtitle" weight="bold">
          {t('audioTools.meter.help.howToMeasure')}
        </Text>
        <View style={styles.stepList}>
          {steps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text variant="caption" weight="bold" tone="accent">
                  {index + 1}
                </Text>
              </View>
              <Text variant="body" tone="secondary" style={styles.stepText}>
                {step}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text variant="subtitle" weight="bold">
            {t('audioTools.meter.help.everydayLevels')}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('audioTools.meter.help.examplesApproximate')}
          </Text>
        </View>

        <View style={styles.referenceChart}>
          <LinearGradient
            colors={[
              theme.colors.status.error,
              '#F97316',
              theme.colors.status.warning,
              theme.colors.status.success,
              theme.colors.primary.main,
            ]}
            locations={[0, 0.22, 0.44, 0.72, 1]}
            style={styles.referenceRail}
          />

          {chartRows.map(({ value, label, current, categoryLabel }, index) => {
            const top =
              CHART_INSET +
              (index / Math.max(chartRows.length - 1, 1)) * (CHART_HEIGHT - CHART_INSET * 2)
            const currentColor = currentBand ? bandColors[currentBand] : theme.colors.status.success

            return current ? (
              <View
                key="current"
                style={[styles.currentRow, { top, backgroundColor: withAlpha(currentColor, 0.1) }]}>
                <View style={[styles.currentMarker, { backgroundColor: currentColor }]} />
                <Text
                  variant="body"
                  weight="bold"
                  style={[styles.referenceDb, { color: currentColor }]}>
                  {value}{' '}
                  <Text variant="caption" style={{ color: currentColor }}>
                    dB
                  </Text>
                </Text>
                <View style={[styles.referenceLabel, styles.currentLabelGroup]}>
                  <Text variant="body" weight="semibold" style={{ color: currentColor }}>
                    {categoryLabel}
                  </Text>
                  <Text variant="caption" style={{ color: currentColor }}>
                    {label}
                  </Text>
                </View>
              </View>
            ) : (
              <View key={value} style={[styles.referenceRow, { top }]}>
                <View style={styles.referenceTick} />
                <Text variant="body" weight="semibold" tone="secondary" style={styles.referenceDb}>
                  {value} <Text variant="caption">dB</Text>
                </Text>
                <Text variant="body" tone="secondary" style={styles.referenceLabel}>
                  {label}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text variant="subtitle" weight="bold">
            {t('audioTools.meter.help.exposureTitle')}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('audioTools.meter.help.exposureDescription')}
          </Text>
        </View>
        <View style={styles.exposureTable}>
          {EXPOSURE_LEVELS.map(({ level, hours }, index) => (
            <View key={level} style={[styles.exposureCell, index > 0 && styles.exposureDivider]}>
              <Text variant="subtitle" weight="bold" tone="accent" align="center">
                {level} dBA
              </Text>
              <Text variant="body" weight="semibold" align="center">
                {hours} h
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="subtitle" weight="bold">
          {t('audioTools.meter.help.useItWell')}
        </Text>
        <View style={styles.tipList}>
          {tips.map(({ icon: IconComponent, title, body }) => (
            <View key={title} style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <IconComponent size={iconSizes.lg} color={theme.colors.primary.main} />
              </View>
              <View style={styles.tipCopy}>
                <Text variant="body" weight="semibold">
                  {title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </NativeBottomSheet>
  )
}

const createStyles = createThemedStyles((t) => ({
  sheetContent: {
    gap: t.spacing.xl,
    paddingHorizontal: t.spacing.xl,
    paddingTop: 60 + t.spacing['3xl'],
    paddingBottom: 156,
  },
  sheetHeader: {
    alignSelf: 'stretch',
  },
  headerMaterial: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.spacing.xl,
    paddingBottom: t.spacing.md,
    backgroundColor: t.colors.background.surface,
  },
  headerFade: {
    height: t.spacing['3xl'],
  },
  sheetTitle: {
    fontSize: t.typography.sizes['2xl'],
  },
  sheetFooter: {
    position: 'relative',
  },
  footerFade: {
    height: t.spacing['5xl'],
  },
  footerMaterial: {
    paddingHorizontal: t.spacing.xl,
    paddingBottom: t.spacing.xl,
    backgroundColor: t.colors.background.surface,
  },
  section: {
    gap: t.spacing.md,
    paddingBottom: t.spacing.xl,
  },
  sectionHeading: {
    gap: t.spacing.xs,
  },
  stepList: {
    gap: t.spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.soft,
  },
  stepText: {
    flex: 1,
    paddingTop: 3,
  },
  referenceChart: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  referenceRail: {
    position: 'absolute',
    top: CHART_INSET,
    bottom: CHART_INSET,
    left: 24,
    width: 6,
    borderRadius: t.borderRadius.full,
  },
  referenceRow: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: 44,
    marginTop: -22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 60,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border.subtle,
  },
  referenceTick: {
    position: 'absolute',
    left: 20,
    width: 24,
    height: 1,
    backgroundColor: t.colors.border.strong,
  },
  referenceDb: {
    width: 88,
    fontVariant: ['tabular-nums'],
  },
  referenceLabel: {
    minWidth: 0,
    flex: 1,
  },
  currentLabelGroup: {
    gap: 1,
  },
  currentRow: {
    position: 'absolute',
    zIndex: 2,
    right: 0,
    left: 8,
    height: 48,
    marginTop: -24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 52,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.lg,
  },
  currentMarker: {
    position: 'absolute',
    left: 7,
    width: 24,
    height: 24,
    borderWidth: 4,
    borderColor: t.colors.background.surface,
    borderRadius: t.borderRadius.full,
    ...t.shadows.sm,
  },
  exposureTable: {
    flexDirection: 'row',
    paddingVertical: t.spacing.lg,
    borderWidth: 1,
    borderColor: t.colors.border.subtle,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.lg,
    backgroundColor: t.colors.primary.soft,
  },
  exposureCell: {
    minWidth: 0,
    flex: 1,
    gap: t.spacing.xs,
  },
  exposureDivider: {
    borderLeftWidth: 1,
    borderLeftColor: t.colors.border.subtle,
  },
  tipList: {
    gap: t.spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  tipIcon: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.soft,
  },
  tipCopy: {
    minWidth: 0,
    flex: 1,
    gap: t.spacing.xs,
  },
}))
