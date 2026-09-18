import { Button, IconButton, Text } from '@shared/core/components/base'
import { withAlpha } from '@shared/core/utils/color'
import {
  ArrowsClockwiseIcon,
  CropIcon,
  FlashlightIcon,
  GearSixIcon,
  RectangleIcon,
  SlidersHorizontalIcon,
  SquaresFourIcon,
  StackIcon,
} from 'phosphor-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Pressable, useWindowDimensions, View } from 'react-native'

import { formatDuration, RESOLUTION_LABELS } from '@/services/camera/types'
import type { RecorderController } from '@/services/camera/useRecorder'
import { useCameraState } from '@/stores/features/camera'
import { createThemedStyles, useThemedStyles } from '@/theme'

import { CameraStage, type PreviewLayout } from './CameraStage'
import { FramingControl } from './FramingControl'
import { RecordingOptions } from './RecordingOptions'

const LAYOUTS: PreviewLayout[] = ['pip', 'stacked', 'guide']
const LAYOUT_ICONS = { pip: SquaresFourIcon, stacked: StackIcon, guide: RectangleIcon }
export function CameraScreen({
  recorder,
  onSettings,
}: {
  recorder: RecorderController
  onSettings: () => void
}) {
  const { width, height } = useWindowDimensions()
  const landscape = width > height
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { settings, phase, updateSettings } = useCameraState()
  const [layout, setLayout] = useState<PreviewLayout>('pip')
  const [options, setOptions] = useState(false)
  const [framing, setFraming] = useState(false)
  useEffect(() => {
    if (phase !== 'idle') setFraming(false)
  }, [phase])
  const idle = phase === 'idle'
  const immersive = layout === 'guide' && !landscape
  const recording = phase === 'recording'
  const layoutLabels = {
    pip: t('camera.layouts.pip'),
    stacked: t('camera.layouts.stacked'),
    guide: t('camera.layouts.guide'),
  }
  const zoomed = recorder.zoom >= 1.5
  const phaseLabels = {
    preparing: t('camera.preparing'),
    finalizing: t('camera.finalizing'),
    exporting: t('camera.exporting'),
    idle: '',
    recording: '',
  }
  const notices: Record<string, string> = {
    saved: t('camera.saved'),
    partialSave: t('camera.partialSave'),
    exportFailed: t('camera.exportFailed'),
    storage: t('camera.storage'),
    thermal: t('camera.thermal'),
    interruption: t('camera.interruption'),
    focusUnavailable: t('camera.focusUnavailable'),
  }
  if (!recorder.authorized)
    return (
      <View style={styles.permission}>
        <Text variant="title" weight="bold" align="center">
          {t('camera.permissionTitle')}
        </Text>
        <Text tone="secondary" align="center">
          {t('camera.permissionBody')}
        </Text>
        <Button
          onPress={() => {
            void recorder.permission()
          }}
          label={t('camera.allowAccess')}
        />
        <Button
          variant="ghost"
          onPress={() => {
            void Linking.openSettings()
          }}
          label={t('camera.openSettings')}
        />
      </View>
    )
  return (
    <View style={styles.root}>
      <View style={[styles.toolbar, immersive && styles.toolbarFloating]}>
        <Pressable
          disabled={!idle}
          onPress={() => setOptions(true)}
          accessibilityRole="button"
          accessibilityLabel={t('camera.cameraOptions')}
          style={styles.profile}>
          <Text variant="label" weight="semibold">
            {RESOLUTION_LABELS[settings.longEdge]} · {settings.fps} ·{' '}
            {settings.container.toUpperCase()}
          </Text>
        </Pressable>
        <IconButton
          icon={SlidersHorizontalIcon}
          accessibilityLabel={t('camera.cameraOptions')}
          disabled={!idle}
          onPress={() => setOptions(true)}
        />
        <IconButton
          icon={GearSixIcon}
          accessibilityLabel={t('camera.settings')}
          disabled={!idle}
          onPress={onSettings}
        />
      </View>
      <View style={[styles.body, landscape && styles.bodyLandscape]}>
        <CameraStage recorder={recorder} layout={layout}>
          {framing && <FramingControl immersive={immersive} onClose={() => setFraming(false)} />}
        </CameraStage>
        <View
          style={[
            styles.panel,
            landscape && styles.panelLandscape,
            immersive && styles.panelFloating,
          ]}>
          {recorder.stats.thermal >= 2 && (
            <Text tone="warning" variant="caption" align="center">
              {t('camera.heatWarning')}
            </Text>
          )}
          {recorder.notice && (
            <Text variant="caption" tone="secondary" align="center">
              {notices[recorder.notice] ?? t('camera.failure')}
            </Text>
          )}
          {recorder.error && (
            <View style={styles.error}>
              <Text variant="caption" tone="error">
                {recorder.error === 'unsupportedSettings'
                  ? t('camera.unsupportedSettings')
                  : t('camera.failure')}
              </Text>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  recorder.clearError()
                  setOptions(true)
                }}
                label={t('camera.retry')}
              />
            </View>
          )}
          <View style={styles.controls}>
            <View style={styles.controlGroup}>
              <IconButton
                icon={FlashlightIcon}
                accessibilityLabel={t('camera.torch')}
                selected={recorder.torchEnabled}
                disabled={!recorder.ready || !recorder.device?.hasTorch}
                onPress={() => {
                  void recorder.torch(!recorder.torchEnabled)
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('camera.toggleZoom', { zoom: zoomed ? 1 : 2 })}
                disabled={!recorder.ready}
                onPress={() => {
                  void recorder.setZoom(zoomed ? 1 : 2, true)
                }}
                style={styles.zoom}>
                <Text variant="label" weight="semibold">
                  {zoomed ? '2x' : '1x'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.controlGroup}>
              <IconButton
                icon={CropIcon}
                accessibilityLabel={t('camera.framing')}
                selected={framing}
                disabled={!idle}
                onPress={() => setFraming(!framing)}
              />
              <IconButton
                icon={LAYOUT_ICONS[layout]}
                accessibilityLabel={t('camera.previewLayout', {
                  layout: layoutLabels[layout],
                })}
                onPress={() => setLayout(LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % LAYOUTS.length])}
              />
              <IconButton
                icon={ArrowsClockwiseIcon}
                accessibilityLabel={t('camera.flip')}
                disabled={!idle || settings.mode === 'dual'}
                onPress={() => updateSettings({ front: !settings.front, deviceId: null })}
              />
            </View>
          </View>
          <View style={styles.bottom}>
            <View style={styles.storage} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={recording ? t('camera.stop') : t('camera.record')}
              disabled={!recording && (!idle || !recorder.ready || !!recorder.error)}
              onPress={() => {
                if (recording) void recorder.stop()
                else void recorder.start()
              }}
              style={[styles.record, !idle && !recording && styles.dim]}>
              <View style={[styles.recordInner, recording && styles.stop]} />
            </Pressable>
            <View style={styles.timer}>
              <Text weight="semibold">{formatDuration(recorder.elapsed)}</Text>
              {!!phaseLabels[phase] && (
                <Text variant="caption" tone="muted">
                  {phaseLabels[phase]}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
      <RecordingOptions recorder={recorder} visible={options} onClose={() => setOptions(false)} />
    </View>
  )
}
const createStyles = createThemedStyles((theme) => ({
  root: { flex: 1, gap: theme.spacing.sm },
  body: { flex: 1, gap: theme.spacing.md },
  bodyLandscape: { flexDirection: 'row' },
  panel: { gap: theme.spacing.sm },
  toolbarFloating: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    zIndex: 2,
  },
  panelFloating: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    zIndex: 2,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: withAlpha(theme.colors.background.base, 0.6),
  },
  panelLandscape: { width: theme.spacing['9xl'] * 2, justifyContent: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  profile: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.surface,
  },
  permission: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlGroup: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  zoom: {
    width: theme.spacing['5xl'],
    height: theme.spacing['5xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius.full,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  storage: { flex: 1 },
  timer: { flex: 1, alignItems: 'flex-end' },
  record: {
    width: theme.spacing['7xl'],
    height: theme.spacing['7xl'],
    borderRadius: theme.borderRadius.full,
    borderWidth: theme.spacing.xs,
    borderColor: theme.colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: {
    width: theme.spacing['6xl'],
    height: theme.spacing['6xl'],
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.status.error,
  },
  stop: {
    width: theme.spacing['3xl'],
    height: theme.spacing['3xl'],
    borderRadius: theme.borderRadius.sm,
  },
  dim: { opacity: 0.4 },
  error: {
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius.md,
  },
}))
