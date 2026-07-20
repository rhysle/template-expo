import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CaretUpIcon,
  TrashIcon,
  WarningIcon,
} from 'phosphor-react-native'
import { useState } from 'react'
import { Alert, ScrollView, View } from 'react-native'

import { Button, Card, Pressable, SegmentedControl, Text } from '@/components/base'
import type { SegmentedOption } from '@/components/base/SegmentedControl'
import { BaseComponentGallery } from '@/components/debug/BaseComponentGallery'
import { DesignTokenSection } from '@/components/debug/DesignTokenSection'
import { ScreenHeader } from '@/components/ScreenHeader'
import { clearUserId as clearUserIdService } from '@/services/userIdentity'
import { useSnackbarState } from '@/stores/features/snackbar'
import { useUserIdentityState } from '@/stores/features/userIdentity'
import { createThemedStyles, iconSizes, useCommonStyles, useTheme, useThemedStyles } from '@/theme'
import {
  clearAllStorage,
  clearPersistedQueryState,
  clearPersistedZustandState,
  diffStates,
  type DiffStatus,
  forceRehydrate,
  getAllStorageEntries,
  getLiveZustandState,
  getRawPersistedQueryState,
  getRawPersistedZustandState,
  getSliceVersionInfo,
  type StorageEntry,
} from '@/utils/debugState'

type ZustandTab = 'live' | 'persisted' | 'diff'

const ZUSTAND_TABS: readonly SegmentedOption<ZustandTab>[] = [
  { label: 'Live', value: 'live' },
  { label: 'Persisted', value: 'persisted' },
  { label: 'Diff', value: 'diff' },
] as const

export default function DebugScreen() {
  const theme = useTheme()
  const commonStyles = useCommonStyles()
  const styles = useThemedStyles(createStyles)
  const { showSnackbar } = useSnackbarState()
  const { userId, clearUserId: clearUserIdSlice } = useUserIdentityState()
  const [zustandTab, setZustandTab] = useState<ZustandTab>('live')

  const readDebugData = () => {
    const sliceVersions = getSliceVersionInfo()
    const storageEntries = getAllStorageEntries()
    const liveState = getLiveZustandState()
    const persistedState = getRawPersistedZustandState()
    const queryState = getRawPersistedQueryState()
    const diff = persistedState ? diffStates(liveState, persistedState) : null
    return { sliceVersions, storageEntries, liveState, persistedState, queryState, diff }
  }

  const [data, setData] = useState(readDebugData)
  const { sliceVersions, storageEntries, liveState, persistedState, queryState, diff } = data

  const refresh = () => setData(readDebugData())

  // Use Alert (not showSnackbar) for feedback after clearing storage.
  // showSnackbar is a Zustand action - it would trigger the persist middleware
  // to re-save the live state immediately, undoing the clear.
  const confirmAndClear = (action: () => void, message: string) => {
    Alert.alert('Confirm', 'This will delete the selected persisted data. Continue?', [
      { text: 'Close', style: 'cancel' },
      {
        text: 'OK',
        style: 'destructive',
        onPress: () => {
          action()
          refresh()
          Alert.alert(message)
        },
      },
    ])
  }

  return (
    <ScrollView style={commonStyles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        <ScreenHeader title="Debug State" subtitle="Inspect live, persisted, and migration state" />

        <DesignTokenSection />

        <CollapsibleSection title="Component Gallery">
          <BaseComponentGallery />
        </CollapsibleSection>

        {/* User Identity */}
        <CollapsibleSection title="User Identity" defaultOpen>
          <Card padding="md">
            <Text variant="caption" weight="semibold" tone="muted">
              User ID
            </Text>
            <Text variant="body" style={styles.monospace}>
              {userId ?? 'Loading...'}
            </Text>
            <View style={styles.divider} />
            <Button
              variant="secondary"
              size="sm"
              label="Reset User ID"
              leftIcon={
                <ArrowClockwiseIcon size={iconSizes.sm} color={theme.colors.text.primary} />
              }
              onPress={() => {
                Alert.alert(
                  'Reset User ID',
                  'This will clear the persisted user ID. A new one will be generated on the next cold start.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: () => {
                        void clearUserIdService().then(() => {
                          clearUserIdSlice()
                          Alert.alert('User ID cleared', 'Restart the app to generate a new ID.')
                        })
                      },
                    },
                  ]
                )
              }}
            />
          </Card>
        </CollapsibleSection>

        {/* Migration Info */}
        <CollapsibleSection title="Migration Info" defaultOpen>
          <Card padding="md">
            <View style={styles.versionRow}>
              <Text variant="caption" weight="semibold" tone="muted">
                Store Version
              </Text>
              <Text variant="body" weight="semibold">
                1
              </Text>
            </View>
            <View style={styles.divider} />
            <Text variant="caption" weight="semibold" tone="muted" style={styles.sectionLabel}>
              Slice Versions
            </Text>
            {sliceVersions.map((info) => (
              <View key={info.name} style={styles.sliceRow}>
                <Text variant="body" weight="medium" style={styles.sliceName}>
                  {info.name}
                </Text>
                <View style={styles.versionBadges}>
                  <Text variant="caption" tone="muted">
                    Persisted: {info.persistedVersion}
                  </Text>
                  <Text variant="caption" tone="muted">
                    Current: {info.currentVersion}
                  </Text>
                  <Text
                    variant="caption"
                    weight="semibold"
                    tone={info.needsMigration ? 'warning' : 'success'}>
                    {info.needsMigration ? 'Pending' : 'OK'}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </CollapsibleSection>

        {/* MMKV Keys */}
        <CollapsibleSection title={`MMKV Storage Keys (${storageEntries.length} keys)`}>
          <Card padding="none">
            {storageEntries.map((entry, i) => (
              <ExpandableEntry
                key={entry.key}
                entry={entry}
                isLast={i === storageEntries.length - 1}
              />
            ))}
          </Card>
        </CollapsibleSection>

        {/* Zustand State */}
        <CollapsibleSection title="Zustand State" defaultOpen>
          <SegmentedControl
            options={ZUSTAND_TABS}
            value={zustandTab}
            onValueChange={setZustandTab}
            size="sm"
            style={styles.segmentedControl}
          />
          {zustandTab === 'live' && <JsonBlock data={liveState} />}
          {zustandTab === 'persisted' &&
            (persistedState ? (
              <JsonBlock data={persistedState} />
            ) : (
              <Card padding="md">
                <Text variant="body" tone="muted" align="center">
                  No persisted state found
                </Text>
              </Card>
            ))}
          {zustandTab === 'diff' &&
            (diff ? (
              <DiffView entries={diff} />
            ) : (
              <Card padding="md">
                <Text variant="body" tone="muted" align="center">
                  No persisted state found
                </Text>
              </Card>
            ))}
        </CollapsibleSection>

        {/* Query Cache */}
        <CollapsibleSection title="Query Cache">
          {queryState ? (
            <JsonBlock data={queryState} />
          ) : (
            <Card padding="md">
              <Text variant="body" tone="muted" align="center">
                No persisted query cache found
              </Text>
            </Card>
          )}
        </CollapsibleSection>

        {/* Actions */}
        <View style={styles.section}>
          <Text variant="subtitle" weight="semibold" style={styles.sectionTitle}>
            Actions
          </Text>
          <View style={styles.actionsGrid}>
            <Button
              variant="secondary"
              size="sm"
              label="Clear Zustand State"
              leftIcon={<TrashIcon size={iconSizes.sm} color={theme.colors.text.primary} />}
              onPress={() => confirmAndClear(clearPersistedZustandState, 'Cleared successfully')}
            />
            <Button
              variant="secondary"
              size="sm"
              label="Clear Query Cache"
              leftIcon={<TrashIcon size={iconSizes.sm} color={theme.colors.text.primary} />}
              onPress={() => confirmAndClear(clearPersistedQueryState, 'Cleared successfully')}
            />
            <Button
              variant="danger"
              size="sm"
              label="Clear All Storage"
              leftIcon={<WarningIcon size={iconSizes.sm} color={theme.colors.text.inverse} />}
              onPress={() => confirmAndClear(clearAllStorage, 'Cleared successfully')}
            />
            <Button
              variant="secondary"
              size="sm"
              label="Force Rehydrate"
              leftIcon={
                <ArrowClockwiseIcon size={iconSizes.sm} color={theme.colors.text.primary} />
              }
              onPress={() => {
                forceRehydrate()
                showSnackbar({ title: 'Rehydrated from persisted state', variant: 'success' })
                refresh()
              }}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

// ── Sub-components ──

const CollapsibleSection = ({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) => {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.sectionHeader}>
        <Text variant="subtitle" weight="semibold">
          {title}
        </Text>
        {open ? (
          <CaretUpIcon size={iconSizes.md} color={theme.colors.text.muted} />
        ) : (
          <CaretDownIcon size={iconSizes.md} color={theme.colors.text.muted} />
        )}
      </Pressable>
      {open ? children : null}
    </View>
  )
}

const ExpandableEntry = ({ entry, isLast }: { entry: StorageEntry; isLast: boolean }) => {
  const styles = useThemedStyles(createStyles)
  const [expanded, setExpanded] = useState(false)
  const preview = JSON.stringify(entry.value)
  const truncated = preview.length > 80 ? preview.slice(0, 80) + '...' : preview

  return (
    <Pressable onPress={() => setExpanded((v) => !v)}>
      <View style={[styles.entryRow, !isLast && styles.entryDivider]}>
        <View style={styles.entryHeader}>
          <Text variant="caption" weight="semibold" style={styles.entryKey}>
            {entry.key}
          </Text>
          <Text variant="caption" tone="muted">
            {entry.rawSize}B
          </Text>
        </View>
        <Text
          variant="caption"
          tone="muted"
          style={styles.monospace}
          numberOfLines={expanded ? undefined : 2}>
          {expanded ? JSON.stringify(entry.value, null, 2) : truncated}
        </Text>
      </View>
    </Pressable>
  )
}

const JsonBlock = ({ data }: { data: unknown }) => {
  const styles = useThemedStyles(createStyles)
  const [expanded, setExpanded] = useState(false)
  const json = JSON.stringify(data, null, 2)
  const lines = json.split('\n')
  const isLong = lines.length > 30
  const displayText = expanded || !isLong ? json : lines.slice(0, 30).join('\n') + '\n...'

  return (
    <Card padding="md">
      <Text variant="caption" tone="muted" style={styles.monospace} selectable>
        {displayText}
      </Text>
      {isLong ? (
        <Pressable onPress={() => setExpanded((v) => !v)} style={styles.showMoreButton}>
          <Text variant="caption" tone="accent" weight="medium">
            {expanded ? 'Show less' : `Show all (${lines.length} lines)`}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  )
}

const DiffView = ({ entries }: { entries: ReturnType<typeof diffStates> }) => {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()

  const statusColor: Record<DiffStatus, string> = {
    same: theme.colors.text.muted,
    changed: theme.colors.status.warning,
    added: theme.colors.status.success,
    removed: theme.colors.status.error,
  }

  const statusLabel: Record<DiffStatus, string> = {
    same: 'same',
    changed: 'changed',
    added: 'added',
    removed: 'removed',
  }

  return (
    <Card padding="none">
      {entries.map((entry, i) => (
        <View
          key={entry.key}
          style={[styles.diffRow, i < entries.length - 1 && styles.entryDivider]}>
          <View style={styles.diffHeader}>
            <Text variant="caption" weight="semibold">
              {entry.key}
            </Text>
            <Text variant="caption" weight="semibold" style={{ color: statusColor[entry.status] }}>
              {statusLabel[entry.status]}
            </Text>
          </View>
          {entry.status === 'changed' && (
            <View style={styles.diffValues}>
              <Text variant="caption" tone="muted" style={styles.monospace} numberOfLines={3}>
                - {JSON.stringify(entry.persistedValue)}
              </Text>
              <Text variant="caption" tone="success" style={styles.monospace} numberOfLines={3}>
                + {JSON.stringify(entry.liveValue)}
              </Text>
            </View>
          )}
        </View>
      ))}
    </Card>
  )
}

// ── Styles ──

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    paddingBottom: t.spacing.xl,
  },
  section: {
    marginBottom: t.spacing.xl,
  },
  sectionTitle: {
    marginBottom: t.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spacing.md,
  },
  sectionLabel: {
    marginBottom: t.spacing.sm,
    marginTop: t.spacing.sm,
  },
  segmentedControl: {
    marginBottom: t.spacing.md,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: t.colors.border.subtle,
    marginVertical: t.spacing.sm,
  },
  sliceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.spacing.xs,
  },
  sliceName: {
    flex: 1,
  },
  versionBadges: {
    flexDirection: 'row',
    gap: t.spacing.md,
    alignItems: 'center',
  },
  entryRow: {
    padding: t.spacing.md,
  },
  entryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border.subtle,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spacing.xs,
  },
  entryKey: {
    flex: 1,
    marginRight: t.spacing.sm,
  },
  monospace: {
    fontFamily: 'monospace',
    fontSize: t.typography.sizes.xs,
  },
  showMoreButton: {
    marginTop: t.spacing.sm,
    alignItems: 'center',
  },
  actionsGrid: {
    gap: t.spacing.sm,
  },
  diffRow: {
    padding: t.spacing.md,
  },
  diffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spacing.xs,
  },
  diffValues: {
    gap: t.spacing.xs,
  },
}))
