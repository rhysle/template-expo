import { BlurTargetView, BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import {
  CheckCircleIcon,
  CrownSimpleIcon,
  InfoIcon,
  LightbulbIcon,
  ShieldCheckIcon,
} from 'phosphor-react-native'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Button, Card, Text } from '@/components/base'
import type { DbActivityRecord } from '@/services/activity'
import { classifyMeterBand, type MeterBand } from '@/services/audio'
import type { PremiumState } from '@/stores/features/subscription'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

import { getDbMeterBandColors } from './dbMeterBands'

interface DbSessionReportProps {
  record: DbActivityRecord
  premiumState: PremiumState
  onUpgrade?: () => void
}

interface InsightDetailsProps {
  band: MeterBand
  color: string
}

const GRADUAL_BLUR_BANDS = [
  { top: '14%', height: '24%', intensity: 2 },
  { top: '26%', height: '26%', intensity: 5 },
  { top: '39%', height: '28%', intensity: 9 },
  { top: '52%', height: '30%', intensity: 15 },
  { top: '65%', height: '35%', intensity: 24 },
] as const

const InsightDetails = ({ band, color }: InsightDetailsProps) => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const profiles = {
    veryQuiet: {
      label: t('activity.report.profile.veryQuiet.label'),
      range: t('activity.report.profile.veryQuiet.range'),
      overview: t('activity.report.profile.veryQuiet.overview'),
      suitable: t('activity.report.profile.veryQuiet.suitable'),
      recommendation: t('activity.report.profile.veryQuiet.recommendation'),
    },
    normal: {
      label: t('activity.report.profile.normal.label'),
      range: t('activity.report.profile.normal.range'),
      overview: t('activity.report.profile.normal.overview'),
      suitable: t('activity.report.profile.normal.suitable'),
      recommendation: t('activity.report.profile.normal.recommendation'),
    },
    loud: {
      label: t('activity.report.profile.loud.label'),
      range: t('activity.report.profile.loud.range'),
      overview: t('activity.report.profile.loud.overview'),
      suitable: t('activity.report.profile.loud.suitable'),
      recommendation: t('activity.report.profile.loud.recommendation'),
    },
    danger: {
      label: t('activity.report.profile.danger.label'),
      range: t('activity.report.profile.danger.range'),
      overview: t('activity.report.profile.danger.overview'),
      suitable: t('activity.report.profile.danger.suitable'),
      recommendation: t('activity.report.profile.danger.recommendation'),
    },
  } as const satisfies Record<
    MeterBand,
    {
      label: string
      range: string
      overview: string
      suitable: string
      recommendation: string
    }
  >
  const profile = profiles[band]

  return (
    <View style={styles.details}>
      <View style={styles.ratingRow}>
        <View style={[styles.insightIcon, { backgroundColor: withAlpha(color, 0.1) }]}>
          <ShieldCheckIcon size={iconSizes.md} color={color} weight="fill" />
        </View>
        <View style={styles.sectionCopy}>
          <Text variant="caption" tone="secondary">
            {t('activity.report.environmentRating')}
          </Text>
          <Text variant="subtitle" weight="bold" style={{ color }}>
            {profile.label} · {profile.range}
          </Text>
        </View>
      </View>

      <Text variant="body" tone="secondary" style={styles.paragraph}>
        {profile.overview}
      </Text>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <CheckCircleIcon size={iconSizes.sm} color={colors.status.success} weight="fill" />
          <Text variant="body" weight="semibold">
            {t('activity.report.suitableFor')}
          </Text>
        </View>
        <Text variant="body" tone="secondary" style={styles.paragraph}>
          {profile.suitable}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <LightbulbIcon size={iconSizes.sm} color={colors.status.warning} weight="fill" />
          <Text variant="body" weight="semibold">
            {t('activity.report.recommendation')}
          </Text>
        </View>
        <Text variant="body" tone="secondary" style={styles.paragraph}>
          {profile.recommendation}
        </Text>
      </View>

      <View style={styles.disclaimer}>
        <InfoIcon size={iconSizes.sm} color={colors.text.muted} weight="fill" />
        <Text variant="caption" tone="muted" style={styles.sectionCopy}>
          {t('activity.report.disclaimer')}
        </Text>
      </View>
    </View>
  )
}

export const DbSessionReport = ({ record, premiumState, onUpgrade }: DbSessionReportProps) => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { appearance, colors } = useTheme()
  const blurTargetRef = useRef<View>(null)
  const band = classifyMeterBand(record.averageDb)
  const color = getDbMeterBandColors(colors)[band]
  const isPremium = premiumState === 'premium'
  const canUpgrade = premiumState === 'free' && onUpgrade !== undefined

  return (
    <Card padding="none" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <CrownSimpleIcon size={iconSizes.md} color={colors.primary.main} weight="fill" />
        </View>
        <View style={styles.sectionCopy}>
          <Text variant="subtitle" weight="bold">
            {t('activity.report.title')}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('activity.report.subtitle')}
          </Text>
        </View>
        <View style={styles.premiumBadge}>
          <Text variant="caption" weight="semibold" tone="accent">
            {t('activity.report.premium')}
          </Text>
        </View>
      </View>

      <View style={styles.summary}>
        <Text variant="body" weight="semibold">
          {t('activity.report.sessionSummary', {
            average: Math.round(record.averageDb),
            maximum: Math.round(record.maximumDb),
            seconds: Math.round(record.durationSeconds),
          })}
        </Text>
      </View>

      {isPremium ? (
        <View style={styles.detailsContainer}>
          <InsightDetails band={band} color={color} />
        </View>
      ) : (
        <View style={styles.lockedPreview}>
          <BlurTargetView
            ref={blurTargetRef}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.detailsContainer}>
            <InsightDetails band={band} color={color} />
          </BlurTargetView>

          <View pointerEvents="none" style={styles.blurOverlay}>
            {GRADUAL_BLUR_BANDS.map(({ top, height, intensity }) => (
              <BlurView
                key={intensity}
                blurTarget={blurTargetRef}
                blurMethod="dimezisBlurViewSdk31Plus"
                blurReductionFactor={3}
                intensity={intensity}
                tint={appearance}
                style={[styles.blurBand, { top, height }]}
              />
            ))}
            <LinearGradient
              colors={[
                withAlpha(colors.background.card, 0),
                withAlpha(colors.background.card, 0.02),
                withAlpha(colors.background.card, 0.08),
                withAlpha(colors.background.card, 0.18),
                withAlpha(colors.background.card, 0.38),
                withAlpha(colors.background.card, 0.68),
                withAlpha(colors.background.card, 0.96),
              ]}
              locations={[0, 0.2, 0.35, 0.5, 0.65, 0.82, 1]}
              style={styles.blurVeil}
            />
          </View>

          <View pointerEvents="box-none" style={styles.upgradeLayer}>
            <View style={styles.upgradeCard}>
              <Text variant="body" weight="semibold" align="center">
                {t('activity.report.unlockTitle')}
              </Text>
              <Text variant="caption" tone="secondary" align="center">
                {t('activity.report.unlockBody')}
              </Text>
              <Button
                fullWidth
                haptic={canUpgrade}
                disabled={!canUpgrade}
                label={t('activity.report.unlockAction')}
                leftIcon={
                  <CrownSimpleIcon size={iconSizes.sm} color={colors.text.inverse} weight="fill" />
                }
                onPress={onUpgrade}
              />
            </View>
          </View>
        </View>
      )}
    </Card>
  )
}

const createStyles = createThemedStyles((t) => ({
  card: {
    borderWidth: 1,
    borderColor: t.colors.border.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    padding: t.spacing.lg,
    paddingBottom: t.spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.soft,
  },
  sectionCopy: {
    minWidth: 0,
    flex: 1,
  },
  premiumBadge: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.soft,
  },
  summary: {
    marginHorizontal: t.spacing.lg,
    padding: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    backgroundColor: t.colors.background.subtle,
  },
  detailsContainer: {
    padding: t.spacing.lg,
  },
  details: {
    gap: t.spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  insightIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
  },
  section: {
    gap: t.spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  paragraph: {
    lineHeight: 23,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    paddingTop: t.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: t.colors.border.subtle,
  },
  lockedPreview: {
    height: 372,
    overflow: 'hidden',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  blurBand: {
    position: 'absolute',
    right: 0,
    left: 0,
  },
  blurVeil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  upgradeLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    paddingHorizontal: t.spacing.lg,
  },
  upgradeCard: {
    alignItems: 'center',
    gap: t.spacing.sm,
    padding: t.spacing.lg,
    borderWidth: 1,
    borderColor: t.colors.border.default,
    borderRadius: t.borderRadius.xl,
    backgroundColor: t.colors.background.card,
    ...t.shadows.lg,
  },
}))
