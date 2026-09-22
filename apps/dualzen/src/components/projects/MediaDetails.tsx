import { Button, SegmentedControl, Slider, Text } from '@shared/core/components/base'
import { recordError } from '@shared/core/services/sentry'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, View } from 'react-native'

import {
  deleteMedia,
  exportMedia,
  mediaFile,
  mutateProjects,
  saveMedia,
  videoFile,
} from '@/services/camera/projects'
import {
  type ExportResult,
  formatDuration,
  type OutputKind,
  type PhotoCapture,
  type ProjectMedia,
  sharedCutPoints,
  snapTrim,
  type VideoCapture,
} from '@/services/camera/types'
import { useCameraState } from '@/stores/features/camera'
import { useProjectsState } from '@/stores/features/projects'
import { createThemedStyles, useThemedStyles } from '@/theme'

function recordProjectError(cause: unknown, context: string, details?: Record<string, unknown>) {
  const message = cause instanceof Error ? cause.message : String(cause)
  if (message === 'Camera is busy') return
  recordError(cause, context, details)
}

export function MediaDetails({ media, onClose }: { media: ProjectMedia; onClose: () => void }) {
  return media.mediaType === 'video' ? (
    <VideoDetails video={media} onClose={onClose} />
  ) : (
    <PhotoDetails photo={media} onClose={onClose} />
  )
}

function VideoPlayback({ video, kind }: { video: VideoCapture; kind: OutputKind }) {
  const styles = useThemedStyles(createDetailsStyles)
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
    } catch (cause) {
      recordProjectError(cause, 'projects.saveTrim', { reset })
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
  const styles = useThemedStyles(createDetailsStyles)
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
  children: (value: { kind: OutputKind; available: ProjectMedia['outputs'] }) => ReactNode
  message?: string | null
  setMessage?: (value: string | null) => void
}) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createDetailsStyles)
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
    } catch (cause) {
      recordProjectError(cause, 'projects.exportMediaRequest', {
        media_type: media.mediaType,
        output_count: kinds.length,
        another_copy: again,
      })
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
            .catch((cause) => {
              recordProjectError(cause, 'projects.deleteMedia', { media_type: media.mediaType })
              setMessage(t('projects.exportFailure'))
            })
        },
      },
    ])
  return (
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
                (cause) => {
                  recordProjectError(cause, 'projects.moveMedia', { media_type: media.mediaType })
                  setMessage(t('projects.exportFailure'))
                }
              )
            }
            label={project.name ?? t('projects.default')}
          />
        ))}
      </ScrollView>
      <Button variant="ghost" disabled={busy} onPress={remove} label={t('projects.deleteMedia')} />
    </ScrollView>
  )
}

const createDetailsStyles = createThemedStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background.base },
  details: {
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing['5xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  preview: {
    width: '100%',
    maxHeight: theme.spacing['9xl'] * 3,
    backgroundColor: theme.colors.background.surface,
  },
  pills: { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    flexWrap: 'wrap',
  },
}))
