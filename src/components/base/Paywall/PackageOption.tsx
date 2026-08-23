import { SealCheckIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import type { PurchasesPackage } from 'react-native-purchases'
import Animated, { FadeIn } from 'react-native-reanimated'

import { Pressable } from '@/components/base/Pressable'
import { Text } from '@/components/base/Text'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { getPeriodKey, type PeriodKey } from './savings'

interface PackageOptionProps {
  pkg: PurchasesPackage
  selected: boolean
  onSelect: (pkg: PurchasesPackage) => void
  index: number
  savingsPercent?: number
}

export const PackageOption = ({
  pkg,
  selected,
  onSelect,
  index,
  savingsPercent,
}: PackageOptionProps) => {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { product } = pkg

  const periodKey = getPeriodKey(product.subscriptionPeriod)
  const isFreeTrialAvailable = product.introPrice?.price === 0
  const trialPeriodCount = product.introPrice?.periodNumberOfUnits ?? (__DEV__ ? 3 : 0)
  const trialPeriodUnit = (product.introPrice?.periodUnit ?? (__DEV__ ? 'DAY' : '')).toLowerCase()

  const periodLabels: Record<PeriodKey, string> = {
    day: t('paywall.period.day'),
    week: t('paywall.period.week'),
    month: t('paywall.period.month'),
    year: t('paywall.period.year'),
  }

  const packageTitleLabels: Record<PeriodKey, string> = {
    day: t('paywall.packageTitle.day'),
    week: t('paywall.packageTitle.week'),
    month: t('paywall.packageTitle.month'),
    year: t('paywall.packageTitle.year'),
  }

  const isLifetime = pkg.packageType === 'LIFETIME'
  const localizedTitle = isLifetime
    ? t('paywall.packageTitle.lifetime')
    : periodKey
      ? packageTitleLabels[periodKey]
      : product.title

  const trialUnitLabels: Record<string, string> = {
    day: t('paywall.trialUnit.day'),
    week: t('paywall.trialUnit.week'),
    month: t('paywall.trialUnit.month'),
    year: t('paywall.trialUnit.year'),
  }

  return (
    <Animated.View entering={FadeIn.delay(index * 100)}>
      <Pressable
        style={[styles.container, selected && styles.containerSelected]}
        haptic
        onPress={() => onSelect(pkg)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleWithTrialBadge}>
              <Text variant="body" weight="semibold" numberOfLines={2} style={styles.packageTitle}>
                {isFreeTrialAvailable
                  ? t('paywall.trial', {
                      count: trialPeriodCount,
                      unit: trialUnitLabels[trialPeriodUnit] ?? trialPeriodUnit,
                    })
                  : localizedTitle}
              </Text>
              {isFreeTrialAvailable ? (
                <SealCheckIcon
                  aria-hidden
                  size={iconSizes.md}
                  weight="fill"
                  color={colors.primary.main}
                />
              ) : null}
            </View>
            {savingsPercent !== undefined && savingsPercent > 0 ? (
              <View style={styles.savingsPill}>
                <Text variant="caption" weight="semibold" style={styles.savingsPillText}>
                  {t('paywall.save', { percent: savingsPercent })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            {isFreeTrialAvailable ? (
              <Text variant="caption" tone="muted">
                {t('paywall.then')}{' '}
              </Text>
            ) : null}
            <Text variant="subtitle" weight="bold">
              {product.priceString}
            </Text>
          </View>
          <Text variant="caption" tone="muted" align="right">
            {isLifetime ? t('paywall.period.lifetime') : periodKey ? periodLabels[periodKey] : ''}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    borderWidth: 2,
    borderColor: t.colors.border.default,
    backgroundColor: t.colors.background.card,
  },
  containerSelected: {
    borderColor: t.colors.primary.main,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: t.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    flexWrap: 'wrap',
  },
  titleWithTrialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: t.spacing.xs,
  },
  packageTitle: {
    flexShrink: 1,
  },
  savingsPill: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.main,
  },
  savingsPillText: {
    color: t.colors.text.inverse,
  },
  priceContainer: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
}))
