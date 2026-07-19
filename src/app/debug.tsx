import {
  ArrowClockwiseIcon,
  ArrowRightIcon,
  CaretDownIcon,
  CaretUpIcon,
  CheckIcon,
  TrashIcon,
  WarningIcon,
} from 'phosphor-react-native'
import { useState } from 'react'
import { Alert, ScrollView, View } from 'react-native'

import {
  BottomSheet,
  BouncingDotsLoader,
  Button,
  Card,
  Pressable,
  PulsingRingLoader,
  SegmentedControl,
  SpinArcLoader,
  Text,
  Toggle,
} from '@/components/base'
import type { SegmentedOption } from '@/components/base/SegmentedControl'
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
type PlaygroundTab = 'first' | 'second' | 'third'

const ZUSTAND_TABS: readonly SegmentedOption<ZustandTab>[] = [
  { label: 'Live', value: 'live' },
  { label: 'Persisted', value: 'persisted' },
  { label: 'Diff', value: 'diff' },
] as const

const PLAYGROUND_TABS: readonly SegmentedOption<PlaygroundTab>[] = [
  { label: 'First', value: 'first' },
  { label: 'Second', value: 'second' },
  { label: 'Third', value: 'third' },
] as const

export default function DebugScreen() {
  const theme = useTheme()
  const commonStyles = useCommonStyles()
  const styles = useThemedStyles(createStyles)
  const { showSnackbar } = useSnackbarState()
  const { userId, clearUserId: clearUserIdSlice } = useUserIdentityState()
  const [zustandTab, setZustandTab] = useState<ZustandTab>('live')
  const [playgroundTab, setPlaygroundTab] = useState<PlaygroundTab>('first')
  const [toggleEnabled, setToggleEnabled] = useState(false)
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false)

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

        {/* Component Playground */}
        <CollapsibleSection title="Component Playground">
          <Card padding="md">
            <View style={styles.playgroundContent}>
              <Text variant="caption" weight="semibold" tone="muted">
                Button variants
              </Text>
              <View style={styles.buttonGallery}>
                <Button variant="primary" label="Primary" fullWidth />
                <Button variant="secondary" label="Secondary" fullWidth />
                <Button variant="ghost" label="Ghost" fullWidth />
                <Button variant="outlined" label="Outlined" fullWidth />
                <Button variant="inverted" label="Inverted" fullWidth />
                <Button variant="danger" label="Danger" fullWidth />
                <Button
                  label="With left icon"
                  leftIcon={<CheckIcon size={iconSizes.sm} color={theme.colors.text.inverse} />}
                  fullWidth
                />
                <Button
                  variant="outlined"
                  label="With right icon"
                  rightIcon={
                    <ArrowRightIcon size={iconSizes.sm} color={theme.colors.primary.main} />
                  }
                  fullWidth
                />
                <Button label="Loading" loading fullWidth />
              </View>

              <View style={styles.divider} />
              <Text variant="caption" weight="semibold" tone="muted">
                Loaders
              </Text>
              <View style={styles.loaderRow}>
                <LoaderPreview label="Bouncing dots">
                  <BouncingDotsLoader color={theme.colors.primary.main} />
                </LoaderPreview>
                <LoaderPreview label="Spin arc">
                  <SpinArcLoader color={theme.colors.primary.main} size={28} />
                </LoaderPreview>
                <LoaderPreview label="Pulsing ring">
                  <PulsingRingLoader color={theme.colors.primary.main} />
                </LoaderPreview>
              </View>

              <View style={styles.divider} />
              <Text variant="caption" weight="semibold" tone="muted">
                Segmented control
              </Text>
              <SegmentedControl
                options={PLAYGROUND_TABS}
                value={playgroundTab}
                onValueChange={setPlaygroundTab}
              />
              <Text variant="caption" tone="muted">
                Selected: {playgroundTab}
              </Text>

              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text variant="body" weight="medium">
                    Toggle
                  </Text>
                  <Text variant="caption" tone="muted">
                    {toggleEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
                <Toggle value={toggleEnabled} onValueChange={setToggleEnabled} />
              </View>

              <View style={styles.divider} />
              <Button
                variant="secondary"
                label="Open Bottom Sheet"
                fullWidth
                onPress={() => setIsBottomSheetVisible(true)}
              />

              <View style={styles.divider} />
              <Text variant="caption" weight="semibold" tone="muted">
                Snackbar
              </Text>
              <View style={styles.actionsGrid}>
                <Button
                  variant="secondary"
                  size="sm"
                  label="Default"
                  onPress={() => showSnackbar({ title: 'Hello from snackbar' })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Success"
                  onPress={() => showSnackbar({ title: 'Changes saved', variant: 'success' })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Success + subtitle"
                  onPress={() =>
                    showSnackbar({
                      title: 'Changes saved',
                      subtitle: 'Your data has been saved successfully',
                      variant: 'success',
                    })
                  }
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Error"
                  onPress={() => showSnackbar({ title: 'Something went wrong', variant: 'error' })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Warning"
                  onPress={() => showSnackbar({ title: 'Connection lost', variant: 'warning' })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Info"
                  onPress={() =>
                    showSnackbar({ title: 'A new update is available', variant: 'info' })
                  }
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Neutral"
                  onPress={() => showSnackbar({ title: 'Currency added', variant: 'neutral' })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="With action"
                  onPress={() =>
                    showSnackbar({
                      title: 'Currency removed',
                      variant: 'neutral',
                      action: { label: 'Undo', onPress: () => {} },
                    })
                  }
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Persistent (no auto-dismiss)"
                  onPress={() =>
                    showSnackbar({
                      title: 'Update ready',
                      variant: 'success',
                      durationMs: 0,
                      action: { label: 'Restart', onPress: () => {} },
                    })
                  }
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="No icon override"
                  onPress={() =>
                    showSnackbar({ title: 'Success but no icon', variant: 'success', icon: null })
                  }
                />
              </View>
            </View>
          </Card>
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
      <BottomSheet visible={isBottomSheetVisible} onDismiss={() => setIsBottomSheetVisible(false)}>
        <View style={styles.bottomSheetContent}>
          <Text variant="title" weight="semibold">
            Bottom Sheet
          </Text>
          <Text variant="body" tone="muted">
            Drag down, tap the backdrop, or use the button below to dismiss this sheet.
          </Text>
          <Button label="Dismiss" fullWidth onPress={() => setIsBottomSheetVisible(false)} />
        </View>
      </BottomSheet>
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
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.sectionHeader}>
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

const LoaderPreview = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.loaderPreview}>
      <View style={styles.loaderPreviewAnimation}>{children}</View>
      <Text variant="caption" tone="muted" align="center">
        {label}
      </Text>
    </View>
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
  playgroundContent: {
    gap: t.spacing.md,
  },
  buttonGallery: {
    gap: t.spacing.sm,
  },
  loaderRow: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  loaderPreview: {
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  loaderPreviewAnimation: {
    height: 32,
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleCopy: {
    gap: t.spacing.xs,
  },
  bottomSheetContent: {
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.md,
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
