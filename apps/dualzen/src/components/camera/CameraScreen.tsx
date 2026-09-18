import { Button, IconButton, SegmentedControl, Slider, Text } from '@shared/core/components/base'
import {
  ArrowsClockwiseIcon,
  ArrowsLeftRightIcon,
  FlashlightIcon,
  GearSixIcon,
  GridFourIcon,
  SlidersHorizontalIcon,
} from 'phosphor-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { formatDuration, type OutputKind, RESOLUTION_LABELS } from '@/services/camera/types'
import type { RecorderController } from '@/services/camera/useRecorder'
import { useCameraState } from '@/stores/features/camera'
import { useProjectsState } from '@/stores/features/projects'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { DualRecorderPreview } from '../../../modules/dual-recorder/src/DualRecorderModule'
import { RecordingOptions } from './RecordingOptions'

export function CameraScreen({
  recorder,
  onSettings,
}: {
  recorder: RecorderController
  onSettings: () => void
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const landscape = screenWidth > screenHeight
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const { settings, phase, updateSettings } = useCameraState()
  const { projects, selectedProjectId, selectProject } = useProjectsState()
  const [main, setMain] = useState<OutputKind>('portrait')
  const [options, setOptions] = useState(false)
  const [torch, setTorch] = useState(false)
  const [exposure, setExposure] = useState(0)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const insetX = useSharedValue(0)
  const insetY = useSharedValue(0)
  const insetStartX = useSharedValue(0)
  const insetStartY = useSharedValue(0)
  const pinchStart = useSharedValue(1)
  const lastZoomUpdate = useSharedValue(1)
  const idle = phase === 'idle'
  const recording = phase === 'recording'
  const secondary = main === 'portrait' ? 'landscape' : 'portrait'
  const mainRatio = main === 'portrait' ? 9 / 16 : 16 / 9
  const width = Math.min(stage.width, stage.height * mainRatio)
  const height = width / mainRatio
  const insetWidth = Math.min(
    theme.spacing['9xl'],
    Math.max(theme.spacing['5xl'], stage.width / 3),
    Math.max(
      theme.spacing['5xl'],
      stage.height * 0.65 * (secondary === 'portrait' ? 9 / 16 : 16 / 9)
    )
  )
  const insetHeight = insetWidth / (secondary === 'portrait' ? 9 / 16 : 16 / 9)
  const pan = Gesture.Pan()
    .onStart(() => {
      insetStartX.value = Math.min(
        insetX.value,
        Math.max(0, stage.width - insetWidth - theme.spacing.xl)
      )
      insetStartY.value = Math.min(
        insetY.value,
        Math.max(0, stage.height - insetHeight - theme.spacing.xl)
      )
    })
    .onUpdate((event) => {
      insetX.value = Math.max(
        0,
        Math.min(
          Math.max(0, stage.width - insetWidth - theme.spacing.xl),
          insetStartX.value + event.translationX
        )
      )
      insetY.value = Math.max(
        0,
        Math.min(
          Math.max(0, stage.height - insetHeight - theme.spacing.xl),
          insetStartY.value + event.translationY
        )
      )
    })
  const insetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: Math.min(
          insetX.value,
          Math.max(0, stage.width - insetWidth - theme.spacing.xl)
        ),
      },
      {
        translateY: Math.min(
          insetY.value,
          Math.max(0, stage.height - insetHeight - theme.spacing.xl)
        ),
      },
    ],
  }))
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      pinchStart.value = recorder.zoom
      lastZoomUpdate.value = 1
    })
    .onUpdate((event) => {
      if (Math.abs(event.scale - lastZoomUpdate.value) < 0.035) return
      lastZoomUpdate.value = event.scale
      void recorder.setZoom(pinchStart.value * event.scale)
    })
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event, success) => {
      if (!success || width <= 0 || height <= 0) return
      // Convert from the displayed crop to the full oriented source before metering.
      const source =
        settings.mode === 'dual'
          ? main === 'portrait'
            ? recorder.stats.source1
            : recorder.stats.source2
          : recorder.stats.source0
      if (!source) return
      const cropWidth = Math.min(source.width, source.height * mainRatio)
      const cropHeight = Math.min(source.height, source.width / mainRatio)
      const position = main === 'portrait' ? settings.portraitPosition : settings.landscapePosition
      const x = settings.front ? 1 - event.x / width : event.x / width
      void recorder.focus(
        ((source.width - cropWidth) * (settings.front ? 1 - position : position) + x * cropWidth) /
          source.width,
        ((source.height - cropHeight) * (settings.front ? 1 - position : position) +
          (event.y / height) * cropHeight) /
          source.height,
        main
      )
    })
  const channel = (kind: OutputKind) =>
    settings.mode === 'single' ? 0 : kind === 'portrait' ? 1 : 2
  const position = (kind: OutputKind) =>
    kind === 'portrait' ? settings.portraitPosition : settings.landscapePosition
  const labels = { portrait: t('camera.portrait'), landscape: t('camera.landscape') }
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
      <View style={styles.toolbar}>
        <Pressable
          disabled={!idle}
          onPress={() => setOptions(true)}
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
        <View style={styles.stage} onLayout={(event) => setStage(event.nativeEvent.layout)}>
          {recorder.ready && (
            <GestureDetector gesture={Gesture.Simultaneous(pinch, tap)}>
              <View style={[styles.preview, { width, height }]}>
                <DualRecorderPreview
                  style={styles.fill}
                  channel={channel(main)}
                  portrait={main === 'portrait'}
                  cropPosition={position(main)}
                  mirrored={settings.front}
                />
                {settings.grid && (
                  <View pointerEvents="none" style={styles.fill}>
                    {[1, 2].map((line) => (
                      <View
                        key={`v${line}`}
                        style={[styles.verticalGrid, { left: `${(line * 100) / 3}%` }]}
                      />
                    ))}
                    {[1, 2].map((line) => (
                      <View
                        key={`h${line}`}
                        style={[styles.horizontalGrid, { top: `${(line * 100) / 3}%` }]}
                      />
                    ))}
                  </View>
                )}
                <View style={styles.badge}>
                  <Text variant="caption">{labels[main]}</Text>
                </View>
              </View>
            </GestureDetector>
          )}
          {recorder.ready && (
            <GestureDetector gesture={pan}>
              <Animated.View
                style={[styles.inset, { width: insetWidth, height: insetHeight }, insetStyle]}>
                <DualRecorderPreview
                  style={styles.fill}
                  channel={channel(secondary)}
                  portrait={secondary === 'portrait'}
                  cropPosition={position(secondary)}
                  mirrored={settings.front}
                />
                <View style={styles.badge}>
                  <Text variant="caption">{labels[secondary]}</Text>
                </View>
              </Animated.View>
            </GestureDetector>
          )}
          {!recorder.ready && (
            <View style={styles.permission}>
              <ActivityIndicator color={theme.colors.primary.main} />
              <Text tone="secondary">
                {recorder.device ? t('camera.waiting') : t('camera.noCamera')}
              </Text>
            </View>
          )}
        </View>
        <ScrollView
          style={[styles.panel, landscape && styles.panelLandscape]}
          contentContainerStyle={styles.panelContent}>
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
          <View style={styles.sizes}>
            {recorder.sizes.map((size, index) => (
              <Text key={index} variant="caption" tone="muted">
                {t(index === 0 ? 'camera.portrait' : 'camera.landscape')}{' '}
                {size ? `${size.width}×${size.height}` : '—'}
              </Text>
            ))}
          </View>
          <View style={styles.controls}>
            <IconButton
              icon={FlashlightIcon}
              accessibilityLabel={t('camera.torch')}
              selected={torch}
              disabled={!recorder.device?.hasTorch}
              onPress={() => {
                setTorch(!torch)
                void recorder.torch(!torch)
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                void recorder.setZoom(1)
              }}
              label="1×"
            />
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                void recorder.setZoom(2)
              }}
              label="2×"
            />
            <Text variant="caption" tone="muted">
              {t('camera.zoom', { zoom: recorder.zoom.toFixed(1) })}
            </Text>
            <IconButton
              icon={GridFourIcon}
              accessibilityLabel={t('camera.grid')}
              selected={settings.grid}
              disabled={!idle}
              onPress={() => updateSettings({ grid: !settings.grid })}
            />
            <IconButton
              icon={ArrowsLeftRightIcon}
              accessibilityLabel={t('camera.swap')}
              onPress={() => setMain(secondary)}
            />
            <IconButton
              icon={ArrowsClockwiseIcon}
              accessibilityLabel={t('camera.flip')}
              disabled={!idle || settings.mode === 'dual'}
              onPress={() => {
                setTorch(false)
                updateSettings({ front: !settings.front, deviceId: null })
              }}
            />
          </View>
          <View style={styles.adjustments}>
            <Text variant="caption" tone="muted">
              {idle ? t('camera.crop', { kind: labels[secondary] }) : t('camera.cropFrozen')}
            </Text>
            {idle && (
              <Slider
                accessibilityLabel={t('camera.crop', { kind: labels[secondary] })}
                value={position(secondary)}
                onValueChange={(value) =>
                  updateSettings(
                    secondary === 'portrait'
                      ? { portraitPosition: value }
                      : { landscapePosition: value }
                  )
                }
              />
            )}
            <View style={styles.exposure}>
              <Text variant="caption" tone="muted">
                {t('camera.exposure')}
              </Text>
              <Slider
                style={styles.exposureSlider}
                min={-2}
                max={2}
                step={0.1}
                disabled={!recorder.device?.supportsExposureBias}
                accessibilityLabel={t('camera.exposure')}
                value={exposure}
                onValueChange={(value) => {
                  setExposure(value)
                  void recorder.exposure(value)
                }}
              />
            </View>
          </View>
          <View style={styles.bottom}>
            <View style={styles.storage}>
              <Text variant="caption" tone="secondary">
                {t('camera.remaining', { time: formatDuration(recorder.remaining) })}
              </Text>
              <Text variant="caption" tone="muted">
                {t('camera.storageRate', {
                  amount: ((recorder.bytesPerSecond * 60) / 1e6).toFixed(0),
                  free: (recorder.stats.freeBytes / 1e9).toFixed(1),
                })}
              </Text>
            </View>
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
              <Text variant="caption" tone="muted">
                {phase === 'idle' || phase === 'recording' ? '' : phaseLabels[phase]}
              </Text>
            </View>
          </View>
          <ScrollProjects
            projects={projects}
            selected={selectedProjectId}
            disabled={!idle}
            select={selectProject}
          />
        </ScrollView>
      </View>
      <RecordingOptions recorder={recorder} visible={options} onClose={() => setOptions(false)} />
    </View>
  )
}
function ScrollProjects({
  projects,
  selected,
  disabled,
  select,
}: {
  projects: ReturnType<typeof useProjectsState>['projects']
  selected: string
  disabled: boolean
  select: (id: string) => void
}) {
  const { t } = useTranslation()
  return projects.length > 1 ? (
    <ScrollView horizontal>
      <SegmentedControl
        value={selected}
        disabled={disabled}
        onValueChange={select}
        options={projects.map((project) => ({
          value: project.id,
          label: project.name ?? t('projects.default'),
        }))}
      />
    </ScrollView>
  ) : null
}
const createStyles = createThemedStyles((theme) => ({
  root: { flex: 1, gap: theme.spacing.sm },
  body: { flex: 1, gap: theme.spacing.sm },
  bodyLandscape: { flexDirection: 'row' },
  panel: { flexGrow: 0, maxHeight: '55%' },
  panelLandscape: { width: theme.spacing['9xl'] * 2.4, maxHeight: '100%' },
  panelContent: { gap: theme.spacing.sm },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  profile: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.surface,
  },
  stage: {
    flex: 1,
    minHeight: theme.spacing['9xl'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.background.surface,
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  badge: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    backgroundColor: theme.colors.background.overlay,
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  inset: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.background.base,
  },
  verticalGrid: {
    position: 'absolute',
    width: 1,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.border.strong,
  },
  horizontalGrid: {
    position: 'absolute',
    height: 1,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.border.strong,
  },
  permission: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  sizes: { flexDirection: 'row', justifyContent: 'space-between' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  adjustments: { gap: theme.spacing.xs },
  exposure: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  exposureSlider: { flex: 1 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  storage: { flex: 1, gap: theme.spacing.xs },
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
