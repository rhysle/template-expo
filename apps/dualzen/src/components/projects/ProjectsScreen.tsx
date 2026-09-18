import { Button, SegmentedControl, Slider, Text } from '@shared/core/components/base'
import { randomUUID } from 'expo-crypto'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native'

import {
  deleteProject,
  deleteTake,
  exportTake,
  mutateProjects,
  saveProject,
  saveTake,
  thumbnailFile,
  videoFile,
} from '@/services/camera/projects'
import {
  DEFAULT_PROJECT_ID,
  type ExportResult,
  formatDuration,
  type OutputKind,
  sharedCutPoints,
  snapTrim,
  type Take,
} from '@/services/camera/types'
import { useCameraState } from '@/stores/features/camera'
import { useProjectsState } from '@/stores/features/projects'
import { createThemedStyles, useThemedStyles } from '@/theme'

export function ProjectsScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { projects, takes, selectedProjectId, selectProject } = useProjectsState()
  const { phase } = useCameraState()
  const [selectedTake, setSelectedTake] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ id: string; name: string; createdAt: number } | null>(null)
  const [failure, setFailure] = useState(false)
  const project = projects.find((item) => item.id === selectedProjectId)!
  const selected = takes.find((item) => item.id === selectedTake)
  const items = takes.filter((item) => item.projectId === selectedProjectId)
  const guard = async (action: () => Promise<unknown>) => {
    try {
      await mutateProjects(action)
    } catch {
      setFailure(true)
    }
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
            onPress={() => selectProject(item.id)}
            style={[styles.pill, item.id === selectedProjectId && styles.selectedPill]}>
            <Text>{item.name ?? t('projects.default')}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <Text tone="muted" style={styles.grow}>
          {t('projects.videos', { count: items.length })}
        </Text>
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
      </View>
      {failure && <Text tone="secondary">{t('camera.failure')}</Text>}
      <ScrollView contentContainerStyle={styles.list}>
        {!items.length && (
          <View style={styles.empty}>
            <Text variant="subtitle">{t('projects.emptyTitle')}</Text>
            <Text tone="muted">{t('projects.emptyBody')}</Text>
          </View>
        )}
        {items.map((take) => (
          <Pressable
            accessibilityRole="button"
            key={take.id}
            onPress={() => setSelectedTake(take.id)}
            style={styles.take}>
            <Image source={{ uri: thumbnailFile(take.id).uri }} style={styles.thumbnail} />
            <View style={styles.grow}>
              <Text weight="semibold">
                {t('projects.take', { date: new Date(take.createdAt).toLocaleString() })}
              </Text>
              <Text variant="caption" tone="muted">
                {formatDuration(take.duration)} · {take.settings.fps} FPS ·{' '}
                {take.settings.container.toUpperCase()}
              </Text>
              <Text variant="caption" tone="muted">
                {t('projects.size', {
                  amount: (
                    take.outputs.reduce((sum, output) => sum + output.bytes, 0) / 1048576
                  ).toFixed(1),
                })}
              </Text>
              {(take.error || take.outputs.some((output) => !output.ready)) && (
                <Text variant="caption" tone="accent">
                  {t('projects.incomplete')}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
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
              onChangeText={(name) =>
                setEditor((current) => (current ? { ...current, name } : null))
              }
              style={styles.input}
            />
            <View style={styles.actions}>
              <Button
                variant="ghost"
                onPress={() => setEditor(null)}
                label={t('projects.cancel')}
              />
              <Button
                disabled={!editor?.name.trim()}
                onPress={() => {
                  if (editor)
                    void guard(async () => {
                      await saveProject({ ...editor, name: editor.name.trim() })
                      selectProject(editor.id)
                      setEditor(null)
                    })
                }}
                label={t('projects.save')}
              />
            </View>
          </View>
        </View>
      </Modal>
      {selected && <TakeDetails take={selected} onClose={() => setSelectedTake(null)} />}
    </View>
  )
}

function Playback({ take, kind }: { take: Take; kind: OutputKind }) {
  const styles = useThemedStyles(createStyles)
  const player = useVideoPlayer(videoFile(take, kind).uri, (instance) => {
    instance.loop = false
  })
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={[styles.video, { aspectRatio: kind === 'portrait' ? 9 / 16 : 16 / 9 }]}
    />
  )
}
function TakeDetails({ take, onClose }: { take: Take; onClose: () => void }) {
  const { t } = useTranslation()
  const labels = { portrait: t('camera.portrait'), landscape: t('camera.landscape') }
  const messages = {
    exported: t('projects.exported'),
    exportFailure: t('projects.exportFailure'),
    alreadyExported: t('projects.alreadyExported'),
    trimUnavailable: t('projects.trimUnavailable'),
  }
  const styles = useThemedStyles(createStyles)
  const { projects } = useProjectsState()
  const { phase } = useCameraState()
  const [kind, setKind] = useState<OutputKind>(
    take.outputs.find((output) => output.ready)?.kind ?? 'portrait'
  )
  const [start, setStart] = useState(take.trim?.start ?? 0)
  const [end, setEnd] = useState(take.trim?.end ?? take.duration)
  const [message, setMessage] = useState<
    'exported' | 'exportFailure' | 'alreadyExported' | 'trimUnavailable' | null
  >(null)
  const [exportResults, setExportResults] = useState<ExportResult[]>([])
  const available = take.outputs.filter((output) => output.ready)
  const cuts = sharedCutPoints(take)
  const range = snapTrim(take, start, end)
  const busy = phase !== 'idle'
  const revision = take.trim ? `${take.trim.start}:${take.trim.end}` : 'original'
  const exportOutputs = async (kinds: OutputKind[], again = false) => {
    if (busy) return
    try {
      if (
        !again &&
        kinds.every((item) =>
          take.exports.some((receipt) => receipt.kind === item && receipt.revision === revision)
        )
      ) {
        setMessage('alreadyExported')
        return
      }
      const result = await exportTake(take, kinds, again)
      setExportResults(result)
      setMessage(result.some((item) => item.error) ? 'exportFailure' : 'exported')
    } catch {
      setMessage('exportFailure')
    }
  }
  const changeTrim = async (reset = false) => {
    if (busy) return
    if (!reset && (!range || cuts.length < 3)) {
      setMessage('trimUnavailable')
      return
    }
    try {
      await mutateProjects(() => saveTake({ ...take, trim: reset ? null : range }))
      if (reset) {
        setStart(0)
        setEnd(take.duration)
      }
    } catch {
      setMessage('trimUnavailable')
    }
  }
  const remove = () =>
    Alert.alert(t('projects.deleteTakeTitle'), t('projects.deleteTakeBody'), [
      { text: t('projects.cancel'), style: 'cancel' },
      {
        text: t('projects.deleteTake'),
        style: 'destructive',
        onPress: () => {
          void mutateProjects(() => deleteTake(take))
            .then(onClose)
            .catch(() => setMessage('exportFailure'))
        },
      },
    ])
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose()
      }}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.details}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text variant="subtitle">{t('projects.takeDetails')}</Text>
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
        {available.some((output) => output.kind === kind) && (
          <Playback key={kind} take={take} kind={kind} />
        )}
        <Text tone="muted">
          {formatDuration(take.duration)} · {take.settings.fps} FPS ·{' '}
          {take.settings.container.toUpperCase()} · {take.settings.hdr ? 'HDR' : 'SDR'}
        </Text>
        {take.outputs.map((output) => (
          <Text key={output.kind} variant="caption" tone="muted">
            {labels[output.kind]} · {output.width} × {output.height} ·{' '}
            {(output.bytes / 1048576).toFixed(1)} MB
            {!output.ready ? ` · ${t('projects.incomplete')}` : ''}
          </Text>
        ))}
        <Text variant="subtitle">{t('projects.trim')}</Text>
        <Text variant="caption" tone="muted">
          {t('projects.trimBody')}
        </Text>
        {cuts.length >= 3 ? (
          <>
            <Text>{t('projects.trimStart')}</Text>
            <Slider
              min={0}
              max={take.duration}
              value={start}
              onValueChange={setStart}
              disabled={busy}
            />
            <Text>{t('projects.trimEnd')}</Text>
            <Slider
              min={0}
              max={take.duration}
              value={end}
              onValueChange={setEnd}
              disabled={busy}
            />
            {range && (
              <Text tone="accent">
                {t('projects.trimRange', {
                  start: range.start.toFixed(2),
                  end: range.end.toFixed(2),
                })}
              </Text>
            )}
            <Button
              disabled={busy || !range}
              onPress={() => {
                void changeTrim()
              }}
              label={t('projects.applyTrim')}
            />
          </>
        ) : (
          <Text tone="muted">{t('projects.trimUnavailable')}</Text>
        )}
        {take.trim && (
          <Button
            variant="ghost"
            disabled={busy}
            onPress={() => {
              void changeTrim(true)
            }}
            label={t('projects.resetTrim')}
          />
        )}
        <Text variant="subtitle">{t('projects.export')}</Text>
        <View style={styles.actions}>
          {available.map((output) => (
            <Button
              key={output.kind}
              size="sm"
              disabled={busy}
              onPress={() => {
                void exportOutputs([output.kind])
              }}
              label={labels[output.kind]}
            />
          ))}
          {available.length === 2 && (
            <Button
              size="sm"
              disabled={busy}
              onPress={() => {
                void exportOutputs(['portrait', 'landscape'])
              }}
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
        {message && <Text tone="accent">{messages[message]}</Text>}
        {take.exports.some((receipt) => receipt.revision === revision) && (
          <Button
            variant="ghost"
            disabled={busy}
            onPress={() => {
              void exportOutputs(
                available.map((output) => output.kind),
                true
              )
            }}
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
              disabled={busy || project.id === take.projectId}
              onPress={() => {
                void mutateProjects(() => saveTake({ ...take, projectId: project.id })).catch(() =>
                  setMessage('exportFailure')
                )
              }}
              label={project.name ?? t('projects.default')}
            />
          ))}
        </ScrollView>
        <Button variant="ghost" disabled={busy} onPress={remove} label={t('projects.deleteTake')} />
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
  take: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background.surface,
    alignItems: 'center',
  },
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
  video: {
    width: '100%',
    maxHeight: theme.spacing['9xl'] * 3,
    backgroundColor: theme.colors.background.surface,
  },
}))
