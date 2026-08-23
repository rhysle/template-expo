import { useRouter } from 'expo-router'
import { ClockCounterClockwiseIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Pressable, Text } from '@/components/base'
import { type ActivityRecordKind, useActivityHistory } from '@/services/activity'
import { AnalyticsAppEvents, trackEvent } from '@/services/firebase/analytics'
import { usePremiumGate } from '@/services/revenueCat'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

interface HistoryHeaderButtonProps {
  initialKind?: ActivityRecordKind
}

export const HistoryHeaderButton = ({ initialKind = 'cleaning' }: HistoryHeaderButtonProps) => {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const { counts } = useActivityHistory()
  const { premiumState, requirePremium } = usePremiumGate()

  const openHistory = () => {
    if (premiumState === 'free') {
      trackEvent(AnalyticsAppEvents.HISTORY_LOCKED_VIEWED, { source: 'header' })
    }

    requirePremium('history', () =>
      router.push({ pathname: '/activity-history', params: { initialKind } })
    )
  }

  return (
    <Pressable
      accessibilityLabel={t('activity.history')}
      accessibilityHint={
        premiumState === 'premium'
          ? undefined
          : t('activity.savedCount', { cleaning: counts.cleaning, db: counts.db })
      }
      accessibilityRole="button"
      haptic
      hitSlop={8}
      style={styles.button}
      onPress={openHistory}>
      <ClockCounterClockwiseIcon size={iconSizes.lg} color={colors.text.primary} weight="bold" />
      {counts.total > 0 ? (
        <View style={styles.badge}>
          <Text variant="caption" weight="bold" style={styles.badgeText}>
            {counts.total > 99 ? '99+' : counts.total}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const createStyles = createThemedStyles((t) => ({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: t.borderRadius.full,
    borderWidth: 2,
    borderColor: t.colors.background.base,
    backgroundColor: t.colors.primary.main,
  },
  badgeText: {
    color: t.colors.text.inverse,
    fontSize: 10,
    lineHeight: 12,
  },
}))
