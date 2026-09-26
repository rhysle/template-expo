import {
  Button,
  NativeMenu,
  type NativeMenuAction,
  NativeSegmentedControl,
  SegmentedControl,
  Text,
  useTabBarContentInset,
} from '@shared/core/components/base'
import { recordError } from '@shared/core/services/sentry'
import { withAlpha } from '@shared/core/utils/color'
import { randomUUID } from 'expo-crypto'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { CaretDownIcon, CheckCircleIcon, ImageIcon, WarningCircleIcon } from 'phosphor-react-native'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'

import {
  deleteMediaBatch,
  deleteProject,
  mutateProjects,
  saveProject,
  thumbnailFile,
} from '@/services/camera/projects'
import {
  DEFAULT_PROJECT_ID,
  formatDuration,
  type MediaType,
  type ProjectMedia,
} from '@/services/camera/types'
import { useCameraState } from '@/stores/features/camera'
import { useProjectsState } from '@/stores/features/projects'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { ProjectGlassActionButton, useProjectGlass } from './ProjectGlassControls'
import { useProjectsSelection } from './ProjectsSelectionContext'

type MediaFilter = 'all' | MediaType

function recordProjectError(cause: unknown, context: string, details?: Record<string, unknown>) {
  const message = cause instanceof Error ? cause.message : String(cause)
  if (message === 'Camera is busy') return
  recordError(cause, context, details)
}

export function ProjectsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const styles = useThemedStyles(createStyles)
  const { colors, spacing } = useTheme()
  const glassProps = useProjectGlass()
  const tabBarInset = useTabBarContentInset()
  const { projects, media, selectedProjectId, selectProject } = useProjectsState()
  const { phase } = useCameraState()
  const {
    registerDeleteAction,
    selectedMediaIds,
    selectionMode,
    setSelectedMediaIds,
    setSelectionMode,
  } = useProjectsSelection()
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [editor, setEditor] = useState<{ id: string; name: string; createdAt: number } | null>(null)
  const [failure, setFailure] = useState<'generic' | 'bulkDelete' | null>(null)
  const [gridWidth, setGridWidth] = useState(0)
  const project = projects.find((item) => item.id === selectedProjectId)!
  const busy = phase !== 'idle'
  const projectMedia = media
    .filter((item) => item.projectId === selectedProjectId)
    .sort((a, b) => b.createdAt - a.createdAt)
  const items = projectMedia.filter((item) => filter === 'all' || item.mediaType === filter)
  const selectedItems = projectMedia.filter((item) => selectedMediaIds.has(item.id))
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedMediaIds.has(item.id))
  const gridInset = spacing.xs
  const gridGap = spacing.xs
  const tileSize = Math.max(0, Math.floor((gridWidth - gridInset * 2 - gridGap * 2) / 3))

  const guard = async (
    operation: string,
    action: () => Promise<unknown>,
    failureKind: 'generic' | 'bulkDelete' = 'generic',
    details?: Record<string, unknown>
  ) => {
    try {
      setFailure(null)
      await mutateProjects(action)
      return true
    } catch (cause) {
      recordProjectError(cause, `projects.${operation}`, details)
      setFailure(failureKind)
      return false
    }
  }
  const exitSelectionMode = () => {
    setSelectionMode(false)
    setFailure(null)
  }
  const selectVisibleItems = () => {
    setSelectedMediaIds((current) => {
      const next = new Set(current)
      for (const item of items) {
        if (allVisibleSelected) next.delete(item.id)
        else next.add(item.id)
      }
      return next
    })
  }
  const toggleMediaSelection = (id: string) => {
    setSelectedMediaIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const saveProjectDraft = (value: { id: string; name: string; createdAt: number }) => {
    const name = value.name.trim()
    if (!name) {
      Alert.alert(t('projects.nameRequired'))
      return
    }
    void guard('saveProject', () => saveProject({ ...value, name })).then((succeeded) => {
      if (!succeeded) return
      exitSelectionMode()
      selectProject(value.id)
      setEditor(null)
    })
  }
  const editProject = (value: { id: string; name: string; createdAt: number }) => {
    if (Platform.OS !== 'ios') {
      setEditor(value)
      return
    }
    const creating = !projects.some((item) => item.id === value.id)
    Alert.prompt(
      creating ? t('projects.new') : t('projects.rename'),
      t('projects.name'),
      [
        { text: t('projects.cancel'), style: 'cancel' },
        {
          text: t('projects.save'),
          onPress: (name?: string) => saveProjectDraft({ ...value, name: name ?? '' }),
        },
      ],
      'plain-text',
      value.name
    )
  }
  useEffect(() => {
    const confirmDeleteSelected = () => {
      if (!selectedItems.length) return
      Alert.alert(
        t('projects.deleteSelectedTitle', { count: selectedItems.length }),
        t('projects.deleteSelectedBody'),
        [
          { text: t('projects.cancel'), style: 'cancel' },
          {
            text: t('projects.deleteSelected'),
            style: 'destructive',
            onPress: () => {
              void guard('deleteMediaBatch', () => deleteMediaBatch(selectedItems), 'bulkDelete', {
                item_count: selectedItems.length,
              }).then((succeeded) => {
                if (succeeded) exitSelectionMode()
              })
            },
          },
        ]
      )
    }
    registerDeleteAction(selectionMode ? confirmDeleteSelected : null)
    return () => registerDeleteAction(null)
  })

  useEffect(() => {
    if (!selectionMode) return
    const availableIds = new Set(
      media.filter((item) => item.projectId === selectedProjectId).map((item) => item.id)
    )
    setSelectedMediaIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [media, selectedProjectId, selectionMode, setSelectedMediaIds])

  useEffect(() => () => setSelectionMode(false), [setSelectionMode])

  const confirmDeleteProject = () =>
    Alert.alert(t('projects.deleteTitle'), t('projects.deleteBody'), [
      { text: t('projects.cancel'), style: 'cancel' },
      {
        text: t('projects.delete'),
        style: 'destructive',
        onPress: () => {
          void guard('deleteProject', () => deleteProject(project.id)).then((succeeded) => {
            if (succeeded) exitSelectionMode()
          })
        },
      },
    ])
  const projectActions = useMemo<readonly NativeMenuAction[]>(
    () => [
      {
        id: 'project-management',
        label: '',
        displayInline: true,
        children: [
          {
            id: 'new',
            label: t('projects.new'),
            disabled: busy,
            image: 'folder.badge.plus',
          },
          {
            id: 'rename',
            label: t('projects.rename'),
            disabled: busy,
            image: 'pencil',
          },
        ],
      } satisfies NativeMenuAction,
      {
        id: 'project-list',
        label: '',
        displayInline: true,
        children: projects.map((item): NativeMenuAction => ({
          id: `project:${item.id}`,
          label: item.name ?? t('projects.default'),
          selected: item.id === selectedProjectId,
          disabled: busy,
          image: 'folder',
        })),
      } satisfies NativeMenuAction,
      ...(project.id === DEFAULT_PROJECT_ID
        ? []
        : [
            {
              id: 'project-danger',
              label: '',
              displayInline: true,
              children: [
                {
                  id: 'delete',
                  label: t('projects.delete'),
                  disabled: busy,
                  destructive: true,
                  image: 'trash',
                },
              ],
            } satisfies NativeMenuAction,
          ]),
    ],
    [busy, project.id, projects, selectedProjectId, t]
  )
  const handleProjectAction = (id: string) => {
    if (id.startsWith('project:')) {
      const projectId = id.slice('project:'.length)
      if (projectId !== selectedProjectId) {
        exitSelectionMode()
        selectProject(projectId)
      }
      return
    }
    if (id === 'new') {
      editProject({ id: randomUUID(), name: '', createdAt: Date.now() })
    } else if (id === 'rename') {
      editProject({ ...project, name: project.name ?? t('projects.default') })
    } else if (id === 'delete') {
      confirmDeleteProject()
    }
  }
  const filterOptions = [
    { value: 'all', label: t('projects.filters.all') },
    { value: 'photo', label: t('projects.filters.photos') },
    { value: 'video', label: t('projects.filters.videos') },
  ] as const
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {selectionMode ? (
          <ProjectGlassActionButton
            {...glassProps}
            disabled={busy || !items.length}
            label={allVisibleSelected ? t('projects.deselectAll') : t('projects.selectAll')}
            onPress={selectVisibleItems}
          />
        ) : (
          <NativeMenu
            actions={projectActions}
            onSelect={handleProjectAction}
            title={t('projects.title')}
            style={styles.projectMenu}>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('projects.changeProject', {
                name: project.name ?? t('projects.default'),
              })}
              style={styles.projectTrigger}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                variant="title"
                weight="bold"
                style={[styles.projectTitle, { maxWidth: screenWidth * 0.56 }]}>
                {project.name ?? t('projects.default')}
              </Text>
              <CaretDownIcon
                aria-hidden
                color={colors.text.secondary}
                size={iconSizes.md}
                weight="bold"
              />
            </View>
          </NativeMenu>
        )}
        <ProjectGlassActionButton
          {...glassProps}
          disabled={busy || (!selectionMode && !projectMedia.length)}
          label={selectionMode ? t('projects.cancel') : t('projects.select')}
          onPress={selectionMode ? exitSelectionMode : () => setSelectionMode(true)}
        />
      </View>
      <View style={styles.filter}>
        {Platform.OS === 'ios' ? (
          <NativeSegmentedControl
            value={filter}
            onValueChange={setFilter}
            options={filterOptions}
          />
        ) : (
          <SegmentedControl value={filter} onValueChange={setFilter} options={filterOptions} />
        )}
      </View>
      {failure && (
        <Text tone="error" style={styles.failure}>
          {failure === 'bulkDelete' ? t('projects.bulkDeleteFailure') : t('camera.failure')}
        </Text>
      )}
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.gridContent,
          {
            paddingBottom: tabBarInset + spacing.lg,
          },
        ]}
        columnWrapperStyle={styles.gridRow}
        data={items}
        extraData={selectedMediaIds}
        keyExtractor={(item) => item.id}
        numColumns={3}
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        renderItem={({ item }) => (
          <MediaTile
            media={item}
            selectionMode={selectionMode}
            selected={selectedMediaIds.has(item.id)}
            disabled={selectionMode && busy}
            size={tileSize}
            onPress={() =>
              selectionMode
                ? toggleMediaSelection(item.id)
                : router.push({
                    pathname: '/projects/[mediaId]',
                    params: { mediaId: item.id },
                  })
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image
              source={require('@/assets/images/empty-state.png')}
              contentFit="contain"
              style={styles.emptyImage}
            />
            <View style={styles.emptyCopy}>
              <Text variant="subtitle" align="center">
                {t('projects.emptyTitle')}
              </Text>
              <Text tone="muted" align="center">
                {projectMedia.length ? t('projects.emptyFilterBody') : t('projects.emptyBody')}
              </Text>
            </View>
          </View>
        }
        showsVerticalScrollIndicator={false}
        style={styles.grid}
      />
      <ProjectEditor editor={editor} setEditor={setEditor} onSave={saveProjectDraft} />
    </View>
  )
}

function MediaTile({
  media,
  selectionMode,
  selected,
  disabled,
  size,
  onPress,
}: {
  media: ProjectMedia
  selectionMode: boolean
  selected: boolean
  disabled: boolean
  size: number
  onPress: () => void
}) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const ready = media.outputs.filter((output) => output.ready)
  const output = ready[0]
  const incomplete = Boolean(media.error || media.outputs.some((item) => !item.ready))
  const captureLabel =
    media.mediaType === 'photo' ? t('projects.photoCapture') : t('projects.videoCapture')
  const formatLabel =
    media.mediaType === 'video'
      ? `${formatDuration(media.duration)}, ${media.settings.fps} FPS, ${media.settings.container.toUpperCase()}`
      : `JPEG${output ? `, ${output.width} × ${output.height}` : ''}`
  const sizeLabel = t('projects.size', {
    amount: (media.outputs.reduce((sum, item) => sum + item.bytes, 0) / 1048576).toFixed(1),
  })
  return (
    <Pressable
      accessibilityLabel={[
        captureLabel,
        formatLabel,
        sizeLabel,
        incomplete && t('projects.incomplete'),
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityRole={selectionMode ? 'checkbox' : 'button'}
      accessibilityState={selectionMode ? { checked: selected, disabled } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={[styles.mediaTile, { width: size, height: size }]}>
      <Image
        source={{ uri: thumbnailFile(media.id).uri }}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={120}
        style={styles.tileImage}
      />
      {selected && <View pointerEvents="none" style={styles.selectedTileOverlay} />}
      {incomplete && (
        <View pointerEvents="none" style={[styles.tileBadge, styles.incompleteBadge]}>
          <WarningCircleIcon
            aria-hidden
            color={colors.status.warning}
            size={iconSizes.sm}
            weight="fill"
          />
        </View>
      )}
      <View pointerEvents="none" style={[styles.tileBadge, styles.durationBadge]}>
        {media.mediaType === 'video' ? (
          <Text variant="caption" tone="primary" weight="semibold" style={styles.tabularNumbers}>
            {formatDuration(media.duration)}
          </Text>
        ) : (
          <ImageIcon aria-hidden color={colors.text.primary} size={iconSizes.sm} weight="bold" />
        )}
      </View>
      {selectionMode && selected && (
        <View pointerEvents="none" style={styles.selectionIndicator}>
          <CheckCircleIcon
            aria-hidden
            size={iconSizes.lg}
            color={colors.primary.main}
            weight="fill"
          />
        </View>
      )}
    </Pressable>
  )
}

function ProjectEditor({
  editor,
  setEditor,
  onSave,
}: {
  editor: { id: string; name: string; createdAt: number } | null
  setEditor: (value: { id: string; name: string; createdAt: number } | null) => void
  onSave: (value: { id: string; name: string; createdAt: number }) => void
}) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  return (
    <Modal
      visible={editor !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setEditor(null)}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text variant="subtitle">{t('projects.name')}</Text>
          <TextInput
            accessibilityLabel={t('projects.name')}
            autoFocus
            maxLength={80}
            value={editor?.name ?? ''}
            onChangeText={(name) => setEditor(editor ? { ...editor, name } : null)}
            style={styles.input}
          />
          <View style={styles.actions}>
            <Button variant="ghost" onPress={() => setEditor(null)} label={t('projects.cancel')} />
            <Button
              disabled={!editor?.name.trim()}
              onPress={() => editor && onSave(editor)}
              label={t('projects.save')}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = createThemedStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  projectMenu: { width: '76%', flexShrink: 1, minWidth: 0 },
  projectTrigger: {
    width: '100%',
    minHeight: theme.spacing['5xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  projectTitle: { flexShrink: 1, minWidth: 0 },
  filter: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  failure: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  grid: { flex: 1 },
  gridContent: {
    flexGrow: 1,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  gridRow: { gap: theme.spacing.xs },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing['5xl'],
  },
  emptyImage: {
    width: 300,
    height: 300,
    aspectRatio: 1,
  },
  emptyCopy: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing['3xl'],
  },
  mediaTile: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: theme.borderRadius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.background.surface,
  },
  tileImage: { position: 'absolute', width: '100%', height: '100%' },
  selectedTileOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 3,
    borderColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: withAlpha(theme.colors.primary.main, 0.18),
  },
  tileBadge: {
    position: 'absolute',
    borderRadius: theme.borderRadius.full,
    backgroundColor: withAlpha(theme.colors.background.subtle, 0.5),
    borderCurve: 'continuous',
  },
  incompleteBadge: {
    top: theme.spacing.xs,
    left: theme.spacing.xs,
    padding: theme.spacing.xs,
  },
  durationBadge: {
    bottom: theme.spacing.xs,
    left: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  selectionIndicator: {
    position: 'absolute',
    right: theme.spacing.sm,
    bottom: theme.spacing.sm,
    width: theme.spacing['2xl'],
    height: theme.spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.overlay,
  },
  tabularNumbers: { fontVariant: ['tabular-nums'] },
  pills: { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    flexWrap: 'wrap',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background.overlay,
  },
  sheet: {
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius.xl,
  },
  input: {
    backgroundColor: theme.colors.background.subtle,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    fontWeight: theme.typography.weights.regular,
    fontSize: theme.typography.sizes.lg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  details: {
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing['5xl'],
  },
  preview: {
    width: '100%',
    maxHeight: theme.spacing['9xl'] * 3,
    backgroundColor: theme.colors.background.surface,
  },
}))
