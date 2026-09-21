import {
  Button,
  NativeMenu,
  type NativeMenuAction,
  NativeSegmentedControl,
  SegmentedControl,
  Slider,
  Text,
  useTabBarContentInset,
} from '@shared/core/components/base'
import { withAlpha } from '@shared/core/utils/color'
import { randomUUID } from 'expo-crypto'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import {
  CaretDownIcon,
  CheckCircleIcon,
  CircleIcon,
  WarningCircleIcon,
} from 'phosphor-react-native'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native'

import {
  deleteMedia,
  deleteMediaBatch,
  deleteProject,
  exportMedia,
  mediaFile,
  mutateProjects,
  saveMedia,
  saveProject,
  thumbnailFile,
  videoFile,
} from '@/services/camera/projects'
import {
  DEFAULT_PROJECT_ID,
  type ExportResult,
  formatDuration,
  type MediaType,
  type OutputKind,
  type PhotoCapture,
  type ProjectMedia,
  sharedCutPoints,
  snapTrim,
  type VideoCapture,
} from '@/services/camera/types'
import { useCameraState } from '@/stores/features/camera'
import { useProjectsState } from '@/stores/features/projects'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { ProjectGlassActionButton, useProjectGlass } from './ProjectGlassControls'
import { useProjectsSelection } from './ProjectsSelectionContext'

type MediaFilter = 'all' | MediaType

export function ProjectsScreen() {
  const { t } = useTranslation()
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
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ id: string; name: string; createdAt: number } | null>(null)
  const [failure, setFailure] = useState<'generic' | 'bulkDelete' | null>(null)
  const [gridWidth, setGridWidth] = useState(0)
  const project = projects.find((item) => item.id === selectedProjectId)!
  const selected = media.find((item) => item.id === selectedMedia)
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
    action: () => Promise<unknown>,
    failureKind: 'generic' | 'bulkDelete' = 'generic'
  ) => {
    try {
      setFailure(null)
      await mutateProjects(action)
      return true
    } catch {
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
    void guard(() => saveProject({ ...value, name })).then((succeeded) => {
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
              void guard(() => deleteMediaBatch(selectedItems), 'bulkDelete').then((succeeded) => {
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
          void guard(() => deleteProject(project.id)).then((succeeded) => {
            if (succeeded) exitSelectionMode()
          })
        },
      },
    ])
  const projectActions = useMemo<readonly NativeMenuAction[]>(
    () => [
      ...projects.map((item): NativeMenuAction => ({
        id: `project:${item.id}`,
        label: item.name ?? t('projects.default'),
        selected: item.id === selectedProjectId,
        disabled: busy,
        image: 'folder',
      })),
      {
        id: 'new',
        label: t('projects.new'),
        disabled: busy,
        image: 'folder.badge.plus',
      } satisfies NativeMenuAction,
      {
        id: 'rename',
        label: t('projects.rename'),
        disabled: busy,
        image: 'pencil',
      } satisfies NativeMenuAction,
      ...(project.id === DEFAULT_PROJECT_ID
        ? []
        : [
            {
              id: 'delete',
              label: t('projects.delete'),
              disabled: busy,
              destructive: true,
              image: 'trash',
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
              <Text numberOfLines={1} variant="title" weight="bold" style={styles.projectTitle}>
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
              selectionMode ? toggleMediaSelection(item.id) : setSelectedMedia(item.id)
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="subtitle">{t('projects.emptyTitle')}</Text>
            <Text tone="muted">
              {projectMedia.length ? t('projects.emptyFilterBody') : t('projects.emptyBody')}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        style={styles.grid}
      />
      <ProjectEditor editor={editor} setEditor={setEditor} onSave={saveProjectDraft} />
      {selected && <MediaDetails media={selected} onClose={() => setSelectedMedia(null)} />}
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
    media.mediaType === 'photo'
      ? t('projects.photoCapture', { date: new Date(media.createdAt).toLocaleString() })
      : t('projects.videoCapture', { date: new Date(media.createdAt).toLocaleString() })
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
      {media.mediaType === 'video' && (
        <View pointerEvents="none" style={[styles.tileBadge, styles.durationBadge]}>
          <Text variant="caption" tone="inverse" weight="semibold" style={styles.tabularNumbers}>
            {formatDuration(media.duration)}
          </Text>
        </View>
      )}
      {selectionMode && (
        <View pointerEvents="none" style={styles.selectionIndicator}>
          {selected ? (
            <CheckCircleIcon
              aria-hidden
              size={iconSizes.lg}
              color={colors.primary.main}
              weight="fill"
            />
          ) : (
            <CircleIcon aria-hidden size={iconSizes.lg} color={colors.text.inverse} weight="bold" />
          )}
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

function VideoPlayback({ video, kind }: { video: VideoCapture; kind: OutputKind }) {
  const styles = useThemedStyles(createStyles)
  const player = useVideoPlayer(videoFile(video, kind).uri, (instance) => {
    instance.loop = false
  })
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={[styles.preview, { aspectRatio: kind === 'portrait' ? 9 / 16 : 16 / 9 }]}
    />
  )
}

function MediaDetails({ media, onClose }: { media: ProjectMedia; onClose: () => void }) {
  return media.mediaType === 'video' ? (
    <VideoDetails video={media} onClose={onClose} />
  ) : (
    <PhotoDetails photo={media} onClose={onClose} />
  )
}

function VideoDetails({ video, onClose }: { video: VideoCapture; onClose: () => void }) {
  const { t } = useTranslation()
  const [start, setStart] = useState(video.trim?.start ?? 0)
  const [end, setEnd] = useState(video.trim?.end ?? video.duration)
  const cuts = sharedCutPoints(video)
  const range = snapTrim(video, start, end)
  const [message, setMessage] = useState<string | null>(null)
  const changeTrim = async (reset = false) => {
    if (!reset && (!range || cuts.length < 3)) {
      setMessage(t('projects.trimUnavailable'))
      return
    }
    try {
      await mutateProjects(() => saveMedia({ ...video, trim: reset ? null : range }))
      if (reset) {
        setStart(0)
        setEnd(video.duration)
      }
    } catch {
      setMessage(t('projects.trimUnavailable'))
    }
  }
  return (
    <DetailsShell media={video} onClose={onClose} message={message} setMessage={setMessage}>
      {({ kind, available }) => (
        <>
          {available.some((output) => output.kind === kind) && (
            <VideoPlayback key={kind} video={video} kind={kind} />
          )}
          <Text tone="muted">
            {formatDuration(video.duration)} · {video.settings.fps} FPS ·{' '}
            {video.settings.container.toUpperCase()} · {video.settings.hdr ? 'HDR' : 'SDR'}
          </Text>
          <Text variant="subtitle">{t('projects.trim')}</Text>
          <Text variant="caption" tone="muted">
            {t('projects.trimBody')}
          </Text>
          {cuts.length >= 3 ? (
            <>
              <Text>{t('projects.trimStart')}</Text>
              <Slider min={0} max={video.duration} value={start} onValueChange={setStart} />
              <Text>{t('projects.trimEnd')}</Text>
              <Slider min={0} max={video.duration} value={end} onValueChange={setEnd} />
              {range && (
                <Text tone="accent">
                  {t('projects.trimRange', {
                    start: range.start.toFixed(2),
                    end: range.end.toFixed(2),
                  })}
                </Text>
              )}
              <Button
                disabled={!range}
                onPress={() => void changeTrim()}
                label={t('projects.applyTrim')}
              />
            </>
          ) : (
            <Text tone="muted">{t('projects.trimUnavailable')}</Text>
          )}
          {video.trim && (
            <Button
              variant="ghost"
              onPress={() => void changeTrim(true)}
              label={t('projects.resetTrim')}
            />
          )}
        </>
      )}
    </DetailsShell>
  )
}

function PhotoDetails({ photo, onClose }: { photo: PhotoCapture; onClose: () => void }) {
  const styles = useThemedStyles(createStyles)
  return (
    <DetailsShell media={photo} onClose={onClose}>
      {({ kind, available }) =>
        available.some((output) => output.kind === kind) ? (
          <Image
            source={{ uri: mediaFile(photo, kind).uri }}
            contentFit="contain"
            style={[styles.preview, { aspectRatio: kind === 'portrait' ? 9 / 16 : 16 / 9 }]}
          />
        ) : null
      }
    </DetailsShell>
  )
}

function DetailsShell({
  media,
  onClose,
  children,
  message: externalMessage,
  setMessage: setExternalMessage,
}: {
  media: ProjectMedia
  onClose: () => void
  children: (value: { kind: OutputKind; available: ProjectMedia['outputs'] }) => React.ReactNode
  message?: string | null
  setMessage?: (value: string | null) => void
}) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { projects } = useProjectsState()
  const { phase } = useCameraState()
  const [kind, setKind] = useState<OutputKind>(
    media.outputs.find((output) => output.ready)?.kind ?? 'portrait'
  )
  const [localMessage, setLocalMessage] = useState<string | null>(null)
  const [exportResults, setExportResults] = useState<ExportResult[]>([])
  const available = media.outputs.filter((output) => output.ready)
  const busy = phase !== 'idle'
  const revision =
    media.mediaType === 'video' && media.trim ? `${media.trim.start}:${media.trim.end}` : 'original'
  const message = externalMessage ?? localMessage
  const setMessage = setExternalMessage ?? setLocalMessage
  const labels = { portrait: t('camera.portrait'), landscape: t('camera.landscape') }
  const exportOutputs = async (kinds: OutputKind[], again = false) => {
    if (busy) return
    try {
      if (
        !again &&
        kinds.every((item) =>
          media.exports.some((receipt) => receipt.kind === item && receipt.revision === revision)
        )
      ) {
        setMessage(t('projects.alreadyExported'))
        return
      }
      const result = await exportMedia(media, kinds, again)
      setExportResults(result)
      setMessage(
        result.some((item) => item.error) ? t('projects.exportFailure') : t('projects.exported')
      )
    } catch {
      setMessage(t('projects.exportFailure'))
    }
  }
  const remove = () =>
    Alert.alert(t('projects.deleteMediaTitle'), t('projects.deleteMediaBody'), [
      { text: t('projects.cancel'), style: 'cancel' },
      {
        text: t('projects.deleteMedia'),
        style: 'destructive',
        onPress: () => {
          void mutateProjects(() => deleteMedia(media))
            .then(onClose)
            .catch(() => setMessage(t('projects.exportFailure')))
        },
      },
    ])
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => !busy && onClose()}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.details}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text variant="subtitle">{t('projects.mediaDetails')}</Text>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onPress={onClose}
            label={t('projects.close')}
          />
        </View>
        <SegmentedControl
          value={kind}
          onValueChange={(value) => setKind(value as OutputKind)}
          options={(['portrait', 'landscape'] as const).map((item) => ({
            value: item,
            label: labels[item],
            disabled: !available.some((output) => output.kind === item),
          }))}
        />
        {children({ kind, available })}
        {media.outputs.map((output) => (
          <Text key={output.kind} variant="caption" tone="muted">
            {labels[output.kind]} · {output.width} × {output.height} ·{' '}
            {(output.bytes / 1048576).toFixed(1)} MB
            {!output.ready ? ` · ${t('projects.incomplete')}` : ''}
          </Text>
        ))}
        <Text variant="subtitle">{t('projects.export')}</Text>
        <View style={styles.actions}>
          {available.map((output) => (
            <Button
              key={output.kind}
              size="sm"
              disabled={busy}
              onPress={() => void exportOutputs([output.kind])}
              label={labels[output.kind]}
            />
          ))}
          {available.length === 2 && (
            <Button
              size="sm"
              disabled={busy}
              onPress={() => void exportOutputs(['portrait', 'landscape'])}
              label={t('camera.both')}
            />
          )}
        </View>
        {exportResults.map((result) => (
          <Text key={result.kind} variant="caption" tone={result.error ? 'error' : 'accent'}>
            {labels[result.kind]} ·{' '}
            {result.error ? t('projects.exportFailure') : t('projects.exported')}
          </Text>
        ))}
        {busy && <Text tone="accent">{t('camera.exporting')}</Text>}
        {message && <Text tone="accent">{message}</Text>}
        {media.exports.some((receipt) => receipt.revision === revision) && (
          <Button
            variant="ghost"
            disabled={busy}
            onPress={() =>
              void exportOutputs(
                available.map((output) => output.kind),
                true
              )
            }
            label={t('projects.exportAgain')}
          />
        )}
        <Text variant="subtitle">{t('projects.move')}</Text>
        <ScrollView horizontal contentContainerStyle={styles.pills}>
          {projects.map((project) => (
            <Button
              key={project.id}
              size="sm"
              variant="ghost"
              disabled={busy || project.id === media.projectId}
              onPress={() =>
                void mutateProjects(() => saveMedia({ ...media, projectId: project.id })).catch(
                  () => setMessage(t('projects.exportFailure'))
                )
              }
              label={project.name ?? t('projects.default')}
            />
          ))}
        </ScrollView>
        <Button
          variant="ghost"
          disabled={busy}
          onPress={remove}
          label={t('projects.deleteMedia')}
        />
      </ScrollView>
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
  projectMenu: { flexShrink: 1, maxWidth: '70%' },
  projectTrigger: {
    minHeight: theme.spacing['5xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  projectTitle: { flexShrink: 1 },
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
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing['5xl'],
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
    backgroundColor: theme.colors.background.overlay,
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
    right: theme.spacing.xs,
    bottom: theme.spacing.xs,
    width: theme.spacing['3xl'],
    height: theme.spacing['3xl'],
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
