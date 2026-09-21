import { Button, SegmentedControl, Slider, Text } from '@shared/core/components/base'
import { randomUUID } from 'expo-crypto'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { CheckCircleIcon, CircleIcon } from 'phosphor-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native'

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

type MediaFilter = 'all' | MediaType

export function ProjectsScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { projects, media, selectedProjectId, selectProject } = useProjectsState()
  const { phase } = useCameraState()
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(() => new Set())
  const [editor, setEditor] = useState<{ id: string; name: string; createdAt: number } | null>(null)
  const [failure, setFailure] = useState<'generic' | 'bulkDelete' | null>(null)
  const project = projects.find((item) => item.id === selectedProjectId)!
  const selected = media.find((item) => item.id === selectedMedia)
  const projectMedia = media
    .filter((item) => item.projectId === selectedProjectId)
    .sort((a, b) => b.createdAt - a.createdAt)
  const items = projectMedia.filter((item) => filter === 'all' || item.mediaType === filter)
  const selectedItems = projectMedia.filter((item) => selectedMediaIds.has(item.id))
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedMediaIds.has(item.id))
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
    setSelectedMediaIds(new Set())
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
  const confirmDeleteProject = () =>
    Alert.alert(t('projects.deleteTitle'), t('projects.deleteBody'), [
      { text: t('projects.cancel'), style: 'cancel' },
      {
        text: t('projects.delete'),
        style: 'destructive',
        onPress: () => {
          void guard(() => deleteProject(project.id))
        },
      },
    ])
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="title" weight="bold">
          {t('projects.title')}
        </Text>
        <Button
          size="sm"
          disabled={phase !== 'idle'}
          onPress={() => setEditor({ id: randomUUID(), name: '', createdAt: Date.now() })}
          label={t('projects.new')}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.projectList}
        contentContainerStyle={styles.pills}>
        {projects.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: item.id === selectedProjectId }}
            onPress={() => {
              if (item.id !== selectedProjectId) exitSelectionMode()
              selectProject(item.id)
            }}
            style={[styles.pill, item.id === selectedProjectId && styles.selectedPill]}>
            <Text>{item.name ?? t('projects.default')}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.filter}>
        <SegmentedControl
          value={filter}
          onValueChange={(value) => setFilter(value as MediaFilter)}
          options={[
            { value: 'all', label: t('projects.filters.all') },
            { value: 'photo', label: t('projects.filters.photos') },
            { value: 'video', label: t('projects.filters.videos') },
          ]}
        />
      </View>
      <View style={styles.actions}>
        {selectionMode ? (
          <>
            <Text tone="muted" style={styles.grow}>
              {t('projects.selected', { count: selectedItems.length })}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              disabled={phase !== 'idle' || !items.length}
              onPress={selectVisibleItems}
              label={allVisibleSelected ? t('projects.deselectAll') : t('projects.selectAll')}
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={phase !== 'idle'}
              onPress={exitSelectionMode}
              label={t('projects.cancel')}
            />
            <Button
              size="sm"
              variant="danger"
              disabled={phase !== 'idle' || !selectedItems.length}
              onPress={confirmDeleteSelected}
              label={t('projects.deleteSelected')}
            />
          </>
        ) : (
          <>
            <Text tone="muted" style={styles.grow}>
              {t('projects.items', { count: items.length })}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              disabled={phase !== 'idle' || !projectMedia.length}
              onPress={() => setSelectionMode(true)}
              label={t('projects.select')}
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={phase !== 'idle'}
              onPress={() => setEditor({ ...project, name: project.name ?? t('projects.default') })}
              label={t('projects.rename')}
            />
            {project.id !== DEFAULT_PROJECT_ID && (
              <Button
                size="sm"
                variant="ghost"
                disabled={phase !== 'idle'}
                onPress={confirmDeleteProject}
                label={t('projects.delete')}
              />
            )}
          </>
        )}
      </View>
      {failure && (
        <Text tone="secondary">
          {failure === 'bulkDelete' ? t('projects.bulkDeleteFailure') : t('camera.failure')}
        </Text>
      )}
      <ScrollView contentContainerStyle={styles.list}>
        {!items.length && (
          <View style={styles.empty}>
            <Text variant="subtitle">{t('projects.emptyTitle')}</Text>
            <Text tone="muted">
              {projectMedia.length ? t('projects.emptyFilterBody') : t('projects.emptyBody')}
            </Text>
          </View>
        )}
        {items.map((item) => (
          <MediaCard
            key={item.id}
            media={item}
            selectionMode={selectionMode}
            selected={selectedMediaIds.has(item.id)}
            disabled={selectionMode && phase !== 'idle'}
            onPress={() =>
              selectionMode ? toggleMediaSelection(item.id) : setSelectedMedia(item.id)
            }
          />
        ))}
      </ScrollView>
      <ProjectEditor
        editor={editor}
        setEditor={setEditor}
        onSave={(value) =>
          guard(async () => {
            await saveProject({ ...value, name: value.name.trim() })
            exitSelectionMode()
            selectProject(value.id)
            setEditor(null)
          })
        }
      />
      {selected && <MediaDetails media={selected} onClose={() => setSelectedMedia(null)} />}
    </View>
  )
}

function MediaCard({
  media,
  selectionMode,
  selected,
  disabled,
  onPress,
}: {
  media: ProjectMedia
  selectionMode: boolean
  selected: boolean
  disabled: boolean
  onPress: () => void
}) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const ready = media.outputs.filter((output) => output.ready)
  const output = ready[0]
  return (
    <Pressable
      accessibilityRole={selectionMode ? 'checkbox' : 'button'}
      accessibilityState={selectionMode ? { checked: selected, disabled } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={[styles.mediaCard, selected && styles.selectedMediaCard]}>
      {selectionMode &&
        (selected ? (
          <CheckCircleIcon
            aria-hidden
            size={iconSizes.md}
            color={colors.primary.main}
            weight="fill"
          />
        ) : (
          <CircleIcon aria-hidden size={iconSizes.md} color={colors.text.muted} />
        ))}
      <Image
        source={{ uri: thumbnailFile(media.id).uri }}
        contentFit="cover"
        style={styles.thumbnail}
      />
      <View style={styles.grow}>
        <View style={styles.mediaTitle}>
          <Text weight="semibold">
            {media.mediaType === 'photo'
              ? t('projects.photoCapture', { date: new Date(media.createdAt).toLocaleString() })
              : t('projects.videoCapture', { date: new Date(media.createdAt).toLocaleString() })}
          </Text>
          <Text variant="caption" tone="accent">
            {t(`projects.filters.${media.mediaType === 'photo' ? 'photos' : 'videos'}`)}
          </Text>
        </View>
        {media.mediaType === 'video' ? (
          <Text variant="caption" tone="muted">
            {formatDuration(media.duration)} · {media.settings.fps} FPS ·{' '}
            {media.settings.container.toUpperCase()}
          </Text>
        ) : (
          <Text variant="caption" tone="muted">
            JPEG{output ? ` · ${output.width} × ${output.height}` : ''}
          </Text>
        )}
        <Text variant="caption" tone="muted">
          {t('projects.size', {
            amount: (media.outputs.reduce((sum, item) => sum + item.bytes, 0) / 1048576).toFixed(1),
          })}
        </Text>
        {(media.error || media.outputs.some((item) => !item.ready)) && (
          <Text variant="caption" tone="accent">
            {t('projects.incomplete')}
          </Text>
        )}
      </View>
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
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  projectList: { flexGrow: 0 },
  filter: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  pills: { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
  pill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.subtle,
  },
  selectedPill: { borderWidth: 1, borderColor: theme.colors.primary.main },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    flexWrap: 'wrap',
  },
  grow: { flex: 1 },
  list: { gap: theme.spacing.md, padding: theme.spacing.lg },
  empty: { paddingVertical: theme.spacing['5xl'], gap: theme.spacing.md },
  mediaCard: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background.surface,
    alignItems: 'center',
  },
  selectedMediaCard: {
    borderColor: theme.colors.primary.main,
    backgroundColor: theme.colors.primary.soft,
  },
  mediaTitle: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  thumbnail: {
    width: theme.spacing['7xl'],
    height: theme.spacing['7xl'],
    borderRadius: theme.borderRadius.sm,
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
