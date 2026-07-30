import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, View } from 'react-native'

import { NativeBottomSheet, type NativeBottomSheetMethods, Text } from '@/components/base'
import type { DbActivityRecord } from '@/services/activity'
import type { PremiumState } from '@/stores/features/subscription'
import { createThemedStyles, useThemedStyles } from '@/theme'

import { DbSessionReport } from './DbSessionReport'
import { DbStatsReport } from './DbStatsReport'
import { DbTimelineChart } from './DbTimelineChart'

interface DbSessionSheetProps {
  visible: boolean
  record: DbActivityRecord | null
  premiumState: PremiumState
  onDismiss: () => void
  onUpgrade?: () => void
}

export const DbSessionSheet = ({
  visible,
  record,
  premiumState,
  onDismiss,
  onUpgrade,
}: DbSessionSheetProps) => {
  const { i18n, t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const sheetRef = useRef<NativeBottomSheetMethods>(null)
  const upgradeAfterDismissRef = useRef(false)
  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const handleDismiss = () => {
    const shouldUpgrade = upgradeAfterDismissRef.current
    upgradeAfterDismissRef.current = false
    onDismiss()

    if (shouldUpgrade) onUpgrade?.()
  }

  const handleUpgrade = () => {
    if (Platform.OS !== 'android') {
      onUpgrade?.()
      return
    }

    upgradeAfterDismissRef.current = true
    sheetRef.current?.close()
  }

  return (
    <NativeBottomSheet
      ref={sheetRef}
      visible={visible}
      preset="large"
      scrollable
      contentContainerStyle={styles.sheet}
      onDismiss={handleDismiss}>
      {record ? (
        <>
          <View style={styles.header}>
            <Text variant="title" weight="bold" align="center">
              {t('activity.dbDetail')}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {dateFormatter.format(record.startedAtMs)}
            </Text>
            <Text variant="caption" tone="muted" align="center">
              {t('activity.duration', { seconds: Math.round(record.durationSeconds) })}
            </Text>
          </View>

          <DbStatsReport
            minimumDb={record.minimumDb}
            averageDb={record.averageDb}
            maximumDb={record.maximumDb}
          />

          {record.timeline.length > 1 ? (
            <DbTimelineChart
              accessibilityLabel={t('audioTools.meter.timeline')}
              maxPoints={3_600}
              points={record.timeline}
            />
          ) : null}

          <DbSessionReport
            record={record}
            premiumState={premiumState}
            onUpgrade={onUpgrade ? handleUpgrade : undefined}
          />
        </>
      ) : null}
    </NativeBottomSheet>
  )
}

const createStyles = createThemedStyles((t) => ({
  sheet: {
    gap: t.spacing.lg,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing['3xl'],
  },
  header: {
    alignItems: 'center',
    gap: t.spacing.xs,
  },
}))
