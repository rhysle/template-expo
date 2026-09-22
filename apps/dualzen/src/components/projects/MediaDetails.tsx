import {
  CapsuleNavigationAccessory,
  NativeMenu,
  type NativeMenuAction,
  NativeSegmentedControl,
  Pressable,
  Text,
} from '@shared/core/components/base'
import { recordError } from '@shared/core/services/sentry'
import { useSnackbarState } from '@shared/core/stores/features/snackbar'
import { Image } from 'expo-image'
import { Stack } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import {
  DotsThreeIcon,
  DownloadSimpleIcon,
  ExportIcon,
  FolderSimpleIcon,
  TrashIcon,
} from 'phosphor-react-native'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, type LayoutChangeEvent, View } from 'react-native'

import {
  deleteMedia,
  exportMedia,
  mediaFile,
  mutateProjects,
  saveMedia,
  shareMedia,
  videoFile,
} from '@/services/camera/projects'
import {
  formatDuration,
  type OutputKind,
  type ProjectMedia,
  type VideoCapture,
} from '@/services/camera/types'
import { useCameraState } from '@/stores/features/camera'
import { useProjectsState } from '@/stores/features/projects'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { ProjectBottomActionBar } from './ProjectBottomActionBar'
import { ProjectGlassSurface, useProjectGlass } from './ProjectGlassControls'

interface PreviewBounds {
  height: number
  width: number
}

function recordProjectError(cause: unknown, context: string, details?: Record<string, unknown>) {
  const message = cause instanceof Error ? cause.message : String(cause)
  if (message === 'Camera is busy') return
  recordError(cause, context, details)
}

function fitPreview(bounds: PreviewBounds, kind: OutputKind) {
  const ratio = kind === 'portrait' ? 9 / 16 : 16 / 9
  const width = Math.min(bounds.width, bounds.height * ratio)
  return { width, height: width / ratio }
}

function VideoPlayback({
  bounds,
  kind,
  video,
}: {
  bounds: PreviewBounds
  kind: OutputKind
  video: VideoCapture
}) {
  const styles = useThemedStyles(createDetailsStyles)
  const size = fitPreview(bounds, kind)
  const player = useVideoPlayer(videoFile(video, kind).uri, (instance) => {
    instance.loop = false
  })
  return (
    <VideoView player={player} nativeControls contentFit="contain" style={[styles.preview, size]} />
  )
}

function MediaPreview({
  bounds,
  kind,
  media,
}: {
  bounds: PreviewBounds
  kind: OutputKind
  media: ProjectMedia
}) {
  const styles = useThemedStyles(createDetailsStyles)
  if (bounds.width <= 0 || bounds.height <= 0) return null
  if (media.mediaType === 'video')
    return <VideoPlayback bounds={bounds} kind={kind} video={media} />

  return (
    <Image
      source={{ uri: mediaFile(media, kind).uri }}
      contentFit="contain"
      style={[styles.preview, fitPreview(bounds, kind)]}
    />
  )
}

function ActionItem({
  accessibilityLabel,
  children,
  disabled,
  onPress,
}: {
  accessibilityLabel: string
  children: ReactNode
  disabled?: boolean
  onPress?: () => void
}) {
  const styles = useThemedStyles(createDetailsStyles)
  const content = (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={styles.actionItem}>
      {children}
    </View>
  )
  if (!onPress) return content
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic
      hapticType="selection"
      onPress={onPress}
      style={styles.actionItem}>
      {children}
    </Pressable>
  )
}

export function MediaDetails({ media, onClose }: { media: ProjectMedia; onClose: () => void }) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createDetailsStyles)
  const { colors, spacing } = useTheme()
  const glass = useProjectGlass()
  const { showSnackbar } = useSnackbarState()
  const { projects } = useProjectsState()
  const { phase } = useCameraState()
  const available = media.outputs.filter((output) => output.ready)
  const [kind, setKind] = useState<OutputKind>(available[0]?.kind ?? 'portrait')
  const [previewBounds, setPreviewBounds] = useState<PreviewBounds>({ width: 0, height: 0 })
  const [actionBarInset, setActionBarInset] = useState(0)
  const [sharing, setSharing] = useState(false)
  const currentOutput = available.find((output) => output.kind === kind) ?? available[0]
  const activeKind = currentOutput?.kind ?? kind
  const busy = phase !== 'idle' || sharing
  const labels = useMemo(
    () => ({ portrait: t('camera.portrait'), landscape: t('camera.landscape') }),
    [t]
  )
  const selectorOptions = available.map((output) => ({
    value: output.kind,
    label: labels[output.kind],
  }))

  const showResult = (failed: boolean) =>
    showSnackbar({
      title: failed ? t('projects.exportFailure') : t('projects.exported'),
      variant: failed ? 'error' : 'success',
    })

  const exportOutputs = async (kinds: OutputKind[]) => {
    if (busy) return
    try {
      const results = await exportMedia(media, kinds)
      showResult(results.some((result) => result.error))
    } catch (cause) {
      recordProjectError(cause, 'projects.exportMediaRequest', {
        media_type: media.mediaType,
        output_count: kinds.length,
      })
      showResult(true)
    }
  }

  const handleShare = async () => {
    if (busy || !currentOutput) return
    setSharing(true)
    try {
      await shareMedia(media, activeKind)
    } catch {
      showSnackbar({ title: t('projects.shareFailure'), variant: 'error' })
    } finally {
      setSharing(false)
    }
  }

  const moveToProject = async (projectId: string) => {
    if (busy || projectId === media.projectId) return
    const project = projects.find((item) => item.id === projectId)
    try {
      await mutateProjects(() => saveMedia({ ...media, projectId }))
      showSnackbar({
        title: t('projects.moved', { name: project?.name ?? t('projects.default') }),
        variant: 'success',
      })
    } catch (cause) {
      recordProjectError(cause, 'projects.moveMedia', { media_type: media.mediaType })
      showSnackbar({ title: t('projects.moveFailure'), variant: 'error' })
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
              showSnackbar({ title: t('projects.deleteMediaFailure'), variant: 'error' })
            })
        },
      },
    ])

  const projectActions = useMemo<readonly NativeMenuAction[]>(
    () =>
      projects.map((project) => ({
        id: project.id,
        label: project.name ?? t('projects.default'),
        selected: project.id === media.projectId,
        disabled: busy || project.id === media.projectId,
        image: 'folder',
      })),
    [busy, media.projectId, projects, t]
  )
  const moreActions = useMemo<readonly NativeMenuAction[]>(
    () => [
      {
        id: 'save-both',
        label: t('projects.saveBoth'),
        disabled: busy,
        image: 'square.and.arrow.down',
      },
    ],
    [busy, t]
  )
  const handleMoreAction = (id: string) => {
    if (id === 'save-both') void exportOutputs(available.map((output) => output.kind))
  }

  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setPreviewBounds((current) =>
      current.width === width && current.height === height ? current : { width, height }
    )
  }

  const centerActions = (
    <View style={styles.actionGroupShadow}>
      <ProjectGlassSurface {...glass} style={styles.actionGroupSurface}>
        <View />
      </ProjectGlassSurface>
      <View style={styles.actionGroupContent}>
        <ActionItem
          accessibilityLabel={t('projects.saveCurrent', { orientation: labels[activeKind] })}
          disabled={busy || !currentOutput}
          onPress={() => void exportOutputs([activeKind])}>
          <DownloadSimpleIcon color={colors.text.primary} size={iconSizes.lg} />
        </ActionItem>
        <NativeMenu
          actions={projectActions}
          onSelect={(id) => void moveToProject(id)}
          title={t('projects.move')}
          style={styles.actionMenu}>
          <ActionItem accessibilityLabel={t('projects.move')} disabled={busy}>
            <FolderSimpleIcon color={colors.text.primary} size={iconSizes.lg} />
          </ActionItem>
        </NativeMenu>
        {available.length === 2 && (
          <NativeMenu
            actions={moreActions}
            onSelect={handleMoreAction}
            title={t('projects.moreActions')}
            style={styles.actionMenu}>
            <ActionItem accessibilityLabel={t('projects.moreActions')} disabled={busy}>
              <DotsThreeIcon color={colors.text.primary} size={iconSizes.lg} weight="bold" />
            </ActionItem>
          </NativeMenu>
        )}
      </View>
    </View>
  )

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          presentation: 'card',
          headerShown: true,
          headerBackButtonDisplayMode: 'minimal',
          headerTitleAlign: 'center',
          title: t('projects.mediaDetails'),
          headerTitle:
            selectorOptions.length > 1
              ? () => (
                  <NativeSegmentedControl
                    value={activeKind}
                    onValueChange={setKind}
                    options={selectorOptions}
                    style={styles.headerSelector}
                  />
                )
              : labels[activeKind],
        }}
      />
      <View style={[styles.content, { paddingBottom: actionBarInset + spacing.md }]}>
        <View style={styles.previewFrame} onLayout={onPreviewLayout}>
          {currentOutput ? (
            <MediaPreview
              key={`${media.id}:${activeKind}`}
              bounds={previewBounds}
              kind={activeKind}
              media={media}
            />
          ) : (
            <Text tone="muted">{t('projects.incomplete')}</Text>
          )}
        </View>
        {currentOutput && (
          <View style={styles.metadata}>
            {media.mediaType === 'video' && (
              <Text selectable variant="caption" tone="muted" style={styles.tabularNumbers}>
                {formatDuration(media.duration)} · {media.settings.fps} FPS ·{' '}
                {media.settings.container.toUpperCase()} · {media.settings.hdr ? 'HDR' : 'SDR'}
              </Text>
            )}
            <Text selectable variant="caption" tone="muted" style={styles.tabularNumbers}>
              {labels[activeKind]} · {currentOutput.width} × {currentOutput.height} ·{' '}
              {(currentOutput.bytes / 1048576).toFixed(1)} MB
            </Text>
          </View>
        )}
      </View>
      <ProjectBottomActionBar
        manageTabBarHeight={false}
        onHeightChange={setActionBarInset}
        leading={
          <CapsuleNavigationAccessory
            accessibilityLabel={t('projects.share')}
            disabled={busy || !currentOutput}
            onPress={() => void handleShare()}>
            <ExportIcon color={colors.text.primary} size={iconSizes.lg} />
          </CapsuleNavigationAccessory>
        }
        center={centerActions}
        trailing={
          <CapsuleNavigationAccessory
            accessibilityLabel={t('projects.deleteMedia')}
            disabled={busy}
            onPress={remove}>
            <TrashIcon color={colors.status.error} size={iconSizes.lg} />
          </CapsuleNavigationAccessory>
        }
      />
    </View>
  )
}

const createDetailsStyles = createThemedStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background.base },
  headerSelector: { width: theme.spacing['9xl'] * 2.25 },
  content: {
    flex: 1,
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  previewFrame: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    overflow: 'hidden',
    borderRadius: theme.borderRadius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.background.surface,
  },
  metadata: { alignItems: 'center', gap: theme.spacing.xs },
  tabularNumbers: { fontVariant: ['tabular-nums'] },
  actionGroupShadow: {
    maxWidth: '60%',
    minHeight: theme.spacing['5xl'],
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.md,
  },
  actionGroupSurface: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  actionGroupContent: { flexDirection: 'row', alignItems: 'center' },
  actionItem: {
    width: theme.spacing['5xl'],
    height: theme.spacing['5xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.full,
  },
  actionMenu: { width: theme.spacing['5xl'], height: theme.spacing['5xl'] },
}))
