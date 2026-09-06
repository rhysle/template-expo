import { CheckCircleIcon, CrownIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Text } from '@/components/base/Text'
import { createShadows, createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import type { PaywallComparisonItem, PaywallComparisonValue } from './types'

interface PaywallComparisonTableProps {
  items: PaywallComparisonItem[]
}

interface ComparisonValueProps {
  value: PaywallComparisonValue
  emphasized?: boolean
}

const ComparisonValue = ({ value, emphasized = false }: ComparisonValueProps) => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  if (value.type === 'text') {
    return (
      <Text
        variant="caption"
        weight={emphasized ? 'semibold' : 'regular'}
        tone={emphasized ? 'accent' : 'muted'}
        align="center">
        {value.text}
      </Text>
    )
  }

  if (value.type === 'excluded') {
    return (
      <Text
        accessible
        accessibilityLabel={t('paywall.comparison.excluded')}
        variant="body"
        tone="muted"
        align="center">
        -
      </Text>
    )
  }

  if (value.type === 'unlimited') {
    return (
      <Text
        accessible
        accessibilityLabel={t('paywall.comparison.unlimited')}
        tone="accent"
        align="center"
        style={styles.unlimitedValue}>
        ∞
      </Text>
    )
  }

  return (
    <View accessible accessibilityLabel={t('paywall.comparison.included')}>
      <CheckCircleIcon aria-hidden size={iconSizes.md} weight="fill" color={colors.primary.main} />
    </View>
  )
}

export const PaywallComparisonTable = ({ items }: PaywallComparisonTableProps) => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  return (
    <View style={styles.shadowContainer}>
      <View style={styles.container}>
        <View style={styles.row}>
          <View style={[styles.featureCell, styles.featureHeaderCell]}>
            <Text variant="body" weight="semibold" tone="accent">
              {t('paywall.comparison.features')}
            </Text>
          </View>
          <View style={styles.valueCell}>
            <Text variant="body" weight="semibold" tone="accent" align="center">
              {t('paywall.comparison.free')}
            </Text>
          </View>
          <View style={[styles.valueCell, styles.proHeaderCell]}>
            <CrownIcon aria-hidden size={iconSizes.sm} weight="fill" color={colors.text.inverse} />
            <Text variant="body" weight="bold" tone="inverse" align="center">
              {t('paywall.comparison.pro')}
            </Text>
          </View>
        </View>

        {items.map((item) => {
          const IconComponent = item.icon

          return (
            <View key={item.id} style={[styles.row, styles.comparisonRow]}>
              <View style={styles.featureCell}>
                <IconComponent aria-hidden size={iconSizes.md} color={colors.primary.main} />
                <Text variant="caption" weight="medium" style={styles.featureLabel}>
                  {item.title}
                </Text>
              </View>
              <View style={styles.valueCell}>
                <ComparisonValue value={item.free} />
              </View>
              <View style={[styles.valueCell, styles.proValueCell]}>
                <ComparisonValue value={item.pro} emphasized />
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  shadowContainer: {
    borderRadius: t.borderRadius['2xl'],
    backgroundColor: t.colors.background.card,
    ...createShadows(t.colors.primary.strong).glow,
  },
  container: {
    overflow: 'hidden',
    borderRadius: t.borderRadius['2xl'],
    backgroundColor: t.colors.background.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  comparisonRow: {
    borderTopWidth: 1,
    borderTopColor: t.colors.border.subtle,
  },
  featureCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.md,
  },
  featureLabel: {
    flex: 1,
  },
  featureHeaderCell: {
    paddingStart: t.spacing.md + iconSizes.md + t.spacing.sm,
  },
  valueCell: {
    width: 84,
    minHeight: t.spacing['5xl'],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing.xs,
    paddingVertical: t.spacing.sm,
  },
  proHeaderCell: {
    flexDirection: 'row',
    gap: t.spacing.xs,
    backgroundColor: t.colors.primary.main,
  },
  proValueCell: {
    backgroundColor: t.colors.primary.soft,
  },
  unlimitedValue: {
    fontSize: t.typography.sizes['2xl'],
  },
}))
