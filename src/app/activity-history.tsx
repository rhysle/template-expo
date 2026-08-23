import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { CheckIcon, GaugeIcon, SpeakerHighIcon, TrashIcon } from 'phosphor-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DbSessionSheet } from '@/components/audio'
import {
  NativeAlertDialog,
  NativeBottomSheet,
  Pressable,
  SegmentedControl,
  Text,
} from '@/components/base'
import type {
  ActivityRecordKind,
  ActivityRecordReference,
  CleaningActivityRecord,
  DbActivityRecord,
} from '@/services/activity'
import { deleteActivityRecords, useActivityHistory } from '@/services/activity'
import { AnalyticsAppEvents, trackEvent } from '@/services/firebase/analytics'
import { buildPaywallPath, usePremiumGate } from '@/services/revenueCat'
import { useSnackbarState } from '@/stores/features/snackbar'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

type HistoryKind = ActivityRecordKind
type SelectedRecord =
  { kind: 'cleaning'; record: CleaningActivityRecord } | { kind: 'db'; record: DbActivityRecord }

const getSelectionKey = (kind: ActivityRecordKind, id: string) => `${kind}:${id}`

export default function ActivityHistoryScreen() {
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const { initialKind } = useLocalSearchParams<{ initialKind?: string }>()
  const styles = useThemedStyles(createStyles)
  const { colors, spacing } = useTheme()
  const insets = useSafeAreaInsets()
  const { cleaning, counts, db } = useActivityHistory()
  const { premiumState } = usePremiumGate()
  const { showSnackbar } = useSnackbarState()
  const [kind, setKind] = useState<HistoryKind>(initialKind === 'db' ? 'db' : 'cleaning')
  const [selected, setSelected] = useState<SelectedRecord | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false)
  const historyOptions = [
    { label: t('activity.cleaning'), value: 'cleaning' as const },
    { label: t('activity.soundSessions'), value: 'db' as const },
  ]
  const routineLabels = {
    balanced: t('audioTools.eject.routine.standard'),
    turbo: t('audioTools.eject.routine.turbo'),
  } as const
  const stopReasonLabels = {
    completed: t('activity.stopReason.completed'),
    manual: t('activity.stopReason.manual'),
    blur: t('activity.stopReason.blur'),
    background: t('activity.stopReason.background'),
    interruption: t('activity.stopReason.interruption'),
    'route-change': t('activity.stopReason.route-change'),
    replaced: t('activity.stopReason.replaced'),
    error: t('activity.stopReason.error'),
    incomplete: t('activity.stopReason.incomplete'),
  } as const
  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  useEffect(() => {
    if (premiumState === 'free') router.replace(buildPaywallPath('history'))
  }, [premiumState, router])

  useEffect(() => {
    if (premiumState === 'premium') {
      trackEvent(AnalyticsAppEvents.HISTORY_OPENED, { source: 'screen' })
    }
  }, [premiumState])

  const records: SelectedRecord[] =
    kind === 'cleaning'
      ? cleaning.map((record) => ({ kind: 'cleaning' as const, record }))
      : db.map((record) => ({ kind: 'db' as const, record }))
  const selectedRecords: ActivityRecordReference[] = [
    ...cleaning
      .filter(({ id }) => selectedKeys.has(getSelectionKey('cleaning', id)))
      .map(({ id }) => ({ kind: 'cleaning' as const, id })),
    ...db
      .filter(({ id }) => selectedKeys.has(getSelectionKey('db', id)))
      .map(({ id }) => ({ kind: 'db' as const, id })),
  ]
  const selectedCount = selectedRecords.length
  const allVisibleSelected =
    records.length > 0 &&
    records.every(({ kind: recordKind, record }) =>
      selectedKeys.has(getSelectionKey(recordKind, record.id))
    )

  const exitSelection = () => {
    setIsSelecting(false)
    setSelectedKeys(new Set())
  }

  const toggleSelection = ({ kind: recordKind, record }: SelectedRecord) => {
    const key = getSelectionKey(recordKind, record.id)
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelectedKeys((current) => {
      const next = new Set(current)
      records.forEach(({ kind: recordKind, record }) => {
        const key = getSelectionKey(recordKind, record.id)
        if (allVisibleSelected) next.delete(key)
        else next.add(key)
      })
      return next
    })
  }

  const confirmDeletion = () => {
    if (selectedRecords.length === 0) return
    const deletedCount = selectedRecords.length
    deleteActivityRecords(selectedRecords)
    setDeleteConfirmationVisible(false)
    exitSelection()
    showSnackbar({
      title:
        deletedCount === 1
          ? t('activity.deletedSingle')
          : t('activity.deletedMultiple', { count: deletedCount }),
      variant: 'success',
    })
  }

  if (premiumState !== 'premium') {
    return (
      <View style={[styles.container, styles.accessState]}>
        <Text variant="body" tone="secondary" align="center">
          {premiumState === 'unknown' ? t('premium.accessUnknown') : t('premium.accessChecking')}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight:
            counts.total > 0
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    haptic
                    hitSlop={8}
                    onPress={() => {
                      if (isSelecting) exitSelection()
                      else {
                        setSelected(null)
                        setIsSelecting(true)
                      }
                    }}
                    style={styles.headerAction}>
                    <Text variant="body" weight="semibold" tone="accent">
                      {isSelecting ? t('common.done') : t('activity.select')}
                    </Text>
                  </Pressable>
                )
              : undefined,
        }}
      />

      <View style={styles.segmentRow}>
        <SegmentedControl
          options={historyOptions}
          value={kind}
          onValueChange={setKind}
          style={styles.segmentedControl}
        />
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.record.id}
        extraData={selectedKeys}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.list, records.length === 0 && styles.emptyList]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="subtitle" weight="semibold" align="center">
              {t('activity.emptyTitle')}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {t('activity.emptyBody')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isCleaning = item.kind === 'cleaning'
          const record = item.record
          const itemSelected = selectedKeys.has(getSelectionKey(item.kind, record.id))
          return (
            <Pressable
              accessibilityRole={isSelecting ? 'checkbox' : 'button'}
              accessibilityState={isSelecting ? { checked: itemSelected } : undefined}
              variant="surface"
              haptic
              style={[styles.record, itemSelected && styles.recordSelected]}
              onPress={() => {
                if (isSelecting) toggleSelection(item)
                else setSelected(item)
              }}>
              <View
                style={[
                  styles.recordIcon,
                  isSelecting && styles.selectionIndicator,
                  itemSelected && styles.selectionIndicatorSelected,
                ]}>
                {isSelecting ? (
                  itemSelected ? (
                    <CheckIcon size={iconSizes.sm} color={colors.text.inverse} weight="bold" />
                  ) : null
                ) : isCleaning ? (
                  <SpeakerHighIcon size={iconSizes.md} color={colors.primary.main} weight="fill" />
                ) : (
                  <GaugeIcon size={iconSizes.md} color={colors.primary.main} weight="bold" />
                )}
              </View>
              <View style={styles.recordCopy}>
                <Text variant="body" weight="semibold">
                  {isCleaning
                    ? routineLabels[(record as CleaningActivityRecord).routineId]
                    : t('activity.dbSession')}
                </Text>
                <Text variant="caption" tone="secondary">
                  {dateFormatter.format(record.startedAtMs)}
                </Text>
              </View>
              <Text variant="caption" tone="muted">
                {t('activity.duration', {
                  seconds: Math.round(
                    isCleaning
                      ? (record as CleaningActivityRecord).actualDurationSeconds
                      : (record as DbActivityRecord).durationSeconds
                  ),
                })}
              </Text>
            </Pressable>
          )
        }}
      />

      {isSelecting ? (
        <View style={[styles.selectionBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable
            accessibilityRole="button"
            disabled={records.length === 0}
            haptic
            onPress={toggleAllVisible}
            style={styles.selectAllAction}>
            <Text variant="body" weight="semibold" tone={records.length === 0 ? 'muted' : 'accent'}>
              {allVisibleSelected ? t('activity.deselectAll') : t('activity.selectAll')}
            </Text>
          </Pressable>

          <Text variant="caption" tone="secondary" align="center" style={styles.selectionCount}>
            {t('activity.selectedCount', { count: selectedCount })}
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={selectedCount === 0}
            haptic
            hapticType="medium"
            onPress={() => setDeleteConfirmationVisible(true)}
            style={[styles.deleteAction, selectedCount === 0 && styles.deleteActionDisabled]}>
            <TrashIcon size={iconSizes.sm} color={colors.text.inverse} weight="bold" />
            <Text variant="body" weight="semibold" style={styles.deleteActionText}>
              {t('activity.deleteSelected', { count: selectedCount })}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <NativeBottomSheet
        visible={selected?.kind === 'cleaning'}
        onDismiss={() => setSelected(null)}>
        {selected?.kind === 'cleaning' ? (
          <View style={styles.sheet}>
            <Text variant="title" weight="bold" align="center">
              {t('activity.cleaningDetail')}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {dateFormatter.format(selected.record.startedAtMs)}
            </Text>
            <View style={styles.detailGrid}>
              <Detail label={t('activity.mode')} value={routineLabels[selected.record.routineId]} />
              <Detail
                label={t('activity.durationLabel')}
                value={t('activity.duration', {
                  seconds: Math.round(selected.record.actualDurationSeconds),
                })}
              />
              <Detail
                label={t('activity.result')}
                value={stopReasonLabels[selected.record.stopReason]}
              />
            </View>
          </View>
        ) : null}
      </NativeBottomSheet>

      <DbSessionSheet
        visible={selected?.kind === 'db'}
        record={selected?.kind === 'db' ? selected.record : null}
        premiumState={premiumState}
        onDismiss={() => setSelected(null)}
      />

      <NativeAlertDialog
        visible={deleteConfirmationVisible}
        title={
          selectedCount === 1
            ? t('activity.deleteConfirmTitleSingle')
            : t('activity.deleteConfirmTitleMultiple', { count: selectedCount })
        }
        message={
          selectedCount === 1
            ? t('activity.deleteConfirmBodySingle')
            : t('activity.deleteConfirmBodyMultiple', { count: selectedCount })
        }
        confirmAction={{
          label: t('activity.delete'),
          role: 'destructive',
          onPress: confirmDeletion,
        }}
        dismissAction={{
          label: t('common.cancel'),
          role: 'cancel',
          onPress: () => setDeleteConfirmationVisible(false),
        }}
        onDismiss={() => setDeleteConfirmationVisible(false)}
      />
    </View>
  )
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <View style={detailStyles.row}>
    <Text variant="caption" tone="secondary">
      {label}
    </Text>
    <Text variant="body" weight="semibold">
      {value}
    </Text>
  </View>
)

const detailStyles = {
  row: { minWidth: '45%' as const, flex: 1, gap: 4 },
}

const createStyles = createThemedStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.background.base },
  accessState: { alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl },
  segmentRow: {
    padding: t.spacing.lg,
  },
  headerAction: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: t.spacing.sm,
  },
  segmentedControl: {
    width: '100%',
  },
  list: { gap: t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing['3xl'] },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.xl },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  recordSelected: {
    borderColor: t.colors.primary.main,
    backgroundColor: t.colors.primary.soft,
  },
  recordIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.soft,
  },
  selectionIndicator: {
    borderWidth: 2,
    borderColor: t.colors.border.strong,
    backgroundColor: 'transparent',
  },
  selectionIndicatorSelected: {
    borderColor: t.colors.primary.main,
    backgroundColor: t.colors.primary.main,
  },
  recordCopy: { minWidth: 0, flex: 1, gap: t.spacing.xs },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingTop: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: t.colors.border.subtle,
    backgroundColor: t.colors.background.card,
  },
  selectAllAction: {
    minHeight: 44,
    minWidth: 88,
    justifyContent: 'center',
  },
  selectionCount: {
    minWidth: 0,
    flex: 1,
  },
  deleteAction: {
    minHeight: 44,
    minWidth: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.status.error,
  },
  deleteActionDisabled: {
    backgroundColor: t.colors.background.subtle,
  },
  deleteActionText: {
    color: t.colors.text.inverse,
  },
  sheet: {
    gap: t.spacing.lg,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.xl,
  },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.lg },
}))
