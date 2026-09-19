import { Button, IconButton, Text } from '@shared/core/components/base'
import {
  ArrowsClockwiseIcon,
  CropIcon,
  GearSixIcon,
  LightningIcon,
  LightningSlashIcon,
  RectangleIcon,
  SlidersHorizontalIcon,
  SquaresFourIcon,
  StackIcon,
} from 'phosphor-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Pressable, useWindowDimensions, View } from 'react-native'
import { cancelAnimation, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { formatDuration, type MediaType, RESOLUTION_LABELS } from '@/services/camera/types'
import type { CaptureController } from '@/services/camera/useRecorder'
import { useCameraState } from '@/stores/features/camera'
import { cameraColors, createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { CameraStage, type PreviewLayout } from './CameraStage'
import { FramingControl } from './FramingControl'
import { RecordingOptions } from './RecordingOptions'

const LAYOUTS: PreviewLayout[] = ['pip', 'stacked', 'guide']
const LAYOUT_ICONS = { pip: SquaresFourIcon, stacked: StackIcon, guide: RectangleIcon }
export function CameraScreen({
  mediaType,
  recorder,
  onSettings,
}: {
  mediaType: MediaType
  recorder: CaptureController
  onSettings: () => void
}) {
  const { width, height } = useWindowDimensions()
  const landscape = width > height
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const { settings, phase, photoFlashMode, setPhotoFlashMode, updateSettings } = useCameraState()
  const [layout, setLayout] = useState<PreviewLayout>('pip')
  const [options, setOptions] = useState(false)
  const [framing, setFraming] = useState(false)
  const [flipTarget, setFlipTarget] = useState<boolean | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState<number>(theme.spacing['5xl'])
  const switchProgress = useSharedValue(0)
  const switching = flipTarget !== null
  useEffect(() => {
    if (
      flipTarget === null ||
      settings.front !== flipTarget ||
      (!recorder.error && (!recorder.ready || recorder.readyDeviceId !== recorder.device?.id))
    )
      return
    // Allow the new preview to settle before revealing it; errors also release the transition.
    switchProgress.set(
      withDelay(
        120,
        withTiming(0, { duration: 220 }, (finished) => {
          if (finished) scheduleOnRN(setFlipTarget, null)
        })
      )
    )
  }, [
    flipTarget,
    settings.front,
    recorder.ready,
    recorder.readyDeviceId,
    recorder.device?.id,
    recorder.error,
    switchProgress,
  ])
  useEffect(() => () => cancelAnimation(switchProgress), [switchProgress])
  useEffect(() => {
    if (phase !== 'idle') setFraming(false)
  }, [phase])
  const idle = phase === 'idle'
  const photoMode = mediaType === 'photo'
  const immersive = layout === 'guide' && !landscape
  const recording = phase === 'recording'
  const layoutLabels = {
    pip: t('camera.layouts.pip'),
    stacked: t('camera.layouts.stacked'),
    guide: t('camera.layouts.guide'),
  }
  const zoomLabel = `${Number(recorder.zoom.toFixed(1))}x`
  const nextZoom =
    recorder.zoomPresets.find((value) => value > recorder.zoom + 0.05) ??
    recorder.zoomPresets[0] ??
    recorder.zoom
  const canFlip = recorder.devices.some(
    (device) => device.position === (settings.front ? 'back' : 'front')
  )
  const flipCamera = () => {
    if (switching || !idle || !recorder.ready || !canFlip || settings.mode === 'dual') return
    const front = !settings.front
    setFraming(false)
    setFlipTarget(front)
    switchProgress.set(
      withTiming(1, { duration: 160 }, (finished) => {
        if (finished) scheduleOnRN(updateSettings, { front, deviceId: null })
      })
    )
  }
  const phaseLabels = {
    preparing: t('camera.preparing'),
    finalizing: t('camera.finalizing'),
    exporting: t('camera.exporting'),
    capturing: t('camera.capturing'),
    idle: '',
    recording: '',
  }
  const notices: Record<string, string> = {
    partialSave: t('camera.partialSave'),
    exportFailed: t('camera.exportFailed'),
    storage: t('camera.storage'),
    thermal: t('camera.thermal'),
    interruption: t('camera.interruption'),
    focusUnavailable: t('camera.focusUnavailable'),
    partialPhotoSave: t('camera.partialPhotoSave'),
  }
  const permissionTitle = photoMode ? t('camera.photoPermissionTitle') : t('camera.permissionTitle')
  const permissionBody = photoMode ? t('camera.photoPermissionBody') : t('camera.permissionBody')
  const flashLabels = {
    off: t('camera.flash.off'),
    auto: t('camera.flash.auto'),
    on: t('camera.flash.on'),
  }
  if (!recorder.authorized)
    return (
      <View style={styles.permission}>
        <Text variant="title" weight="bold" align="center">
          {permissionTitle}
        </Text>
        <Text tone="secondary" align="center">
          {permissionBody}
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
      <View
        style={styles.toolbar}
        onLayout={(event) => setToolbarHeight(event.nativeEvent.layout.height)}>
        <View style={styles.toolbarSide}>
          <Pressable
            disabled={!idle || switching}
            onPress={() => setOptions(true)}
            accessibilityRole="button"
            accessibilityLabel={t('camera.cameraOptions')}
            style={styles.profile}>
            <Text variant="label" weight="semibold" numberOfLines={1}>
              {photoMode
                ? t('camera.photoProfile')
                : `${RESOLUTION_LABELS[settings.longEdge]} · ${settings.fps} · ${settings.container.toUpperCase()}`}
            </Text>
          </Pressable>
        </View>
        {recording && (
          <View style={styles.timerPill}>
            <View style={styles.recordingDot} />
            <Text weight="semibold" style={styles.timer}>
              {formatDuration(recorder.elapsed)}
            </Text>
          </View>
        )}
        <View style={[styles.toolbarSide, styles.toolbarActions]}>
          <IconButton
            icon={SlidersHorizontalIcon}
            accessibilityLabel={t('camera.cameraOptions')}
            disabled={!idle || switching}
            onPress={() => setOptions(true)}
          />
          <IconButton
            icon={GearSixIcon}
            accessibilityLabel={t('camera.settings')}
            disabled={!idle || switching}
            onPress={onSettings}
          />
        </View>
      </View>
      <View style={[styles.body, landscape && styles.bodyLandscape]}>
        <CameraStage
          recorder={recorder}
          layout={layout}
          edgeToEdgePortrait={!landscape}
          topInset={
            !landscape && (layout === 'pip' || immersive) ? 0 : toolbarHeight + theme.spacing.sm * 2
          }
          bottomInset={immersive || landscape ? 0 : theme.spacing['7xl'] + theme.spacing.sm * 2}
          switching={switching}
          switchProgress={switchProgress}>
          {framing && <FramingControl onClose={() => setFraming(false)} />}
        </CameraStage>
        <View style={[styles.panel, landscape && styles.panelLandscape]}>
          <View style={[styles.notices, landscape && styles.noticesLandscape]}>
            {!!phaseLabels[phase] && (
              <Text variant="caption" tone="muted" align="center">
                {phaseLabels[phase]}
              </Text>
            )}
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
          </View>
          <View style={styles.controls}>
            <View style={styles.controlGroup}>
              {photoMode ? (
                <Pressable
                  style={[
                    styles.controlButton,
                    styles.torch,
                    (switching ||
                      !recorder.ready ||
                      settings.mode === 'dual' ||
                      settings.front ||
                      !recorder.device?.hasFlash) &&
                      styles.torchUnavailable,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('camera.flashMode', {
                    mode: flashLabels[photoFlashMode],
                  })}
                  disabled={
                    switching ||
                    !recorder.ready ||
                    settings.mode === 'dual' ||
                    settings.front ||
                    !recorder.device?.hasFlash
                  }
                  onPress={() => {
                    const modes = ['off', 'auto', 'on'] as const
                    setPhotoFlashMode(modes[(modes.indexOf(photoFlashMode) + 1) % modes.length])
                  }}>
                  {photoFlashMode === 'off' ? (
                    <LightningSlashIcon size={iconSizes.md} color={theme.colors.text.primary} />
                  ) : (
                    <LightningIcon
                      size={iconSizes.md}
                      weight={photoFlashMode === 'on' ? 'fill' : 'regular'}
                      color={
                        photoFlashMode === 'on'
                          ? theme.colors.primary.main
                          : theme.colors.text.primary
                      }
                    />
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={[
                    styles.controlButton,
                    styles.torch,
                    (switching || !recorder.ready || !recorder.device?.hasTorch) &&
                      styles.torchUnavailable,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('camera.torch')}
                  accessibilityState={{
                    selected: recorder.torchEnabled,
                    disabled: switching || !recorder.ready || !recorder.device?.hasTorch,
                  }}
                  disabled={switching || !recorder.ready || !recorder.device?.hasTorch}
                  onPress={() => {
                    void recorder.torch(!recorder.torchEnabled)
                  }}>
                  {recorder.torchEnabled ? (
                    <LightningIcon
                      size={iconSizes.md}
                      weight="fill"
                      color={theme.colors.primary.main}
                    />
                  ) : (
                    <LightningSlashIcon size={iconSizes.md} color={theme.colors.text.primary} />
                  )}
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('camera.toggleZoom', { zoom: nextZoom })}
                accessibilityValue={{ text: zoomLabel }}
                disabled={switching || !recorder.ready || !recorder.zoomPresets.length}
                onPress={() => {
                  void recorder.setZoom(nextZoom, true)
                }}
                style={styles.zoom}>
                <Text variant="label" weight="semibold">
                  {zoomLabel}
                </Text>
              </Pressable>
              <View style={styles.controlButton} pointerEvents="none" />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                photoMode
                  ? t('camera.takePhoto')
                  : recording
                    ? t('camera.stop')
                    : t('camera.record')
              }
              disabled={
                !recording &&
                (switching ||
                  !idle ||
                  !recorder.ready ||
                  recorder.mediaType !== mediaType ||
                  !!recorder.error)
              }
              onPress={() => {
                if (photoMode) void recorder.takePhoto()
                else if (recording) void recorder.stopVideo()
                else void recorder.startVideo()
              }}
              style={[styles.record, !idle && !recording && styles.dim]}>
              <View
                style={[
                  styles.recordInner,
                  photoMode && styles.photoShutter,
                  recording && styles.stop,
                ]}
              />
            </Pressable>
            <View style={styles.controlGroup}>
              <IconButton
                icon={CropIcon}
                style={styles.controlButton}
                accessibilityLabel={t('camera.framing')}
                selected={framing}
                disabled={!idle || switching}
                onPress={() => setFraming(!framing)}
              />
              <IconButton
                icon={LAYOUT_ICONS[layout]}
                style={styles.controlButton}
                disabled={!idle || switching}
                accessibilityLabel={t('camera.previewLayout', {
                  layout: layoutLabels[layout],
                })}
                onPress={() => setLayout(LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % LAYOUTS.length])}
              />
              <IconButton
                icon={ArrowsClockwiseIcon}
                style={styles.controlButton}
                accessibilityLabel={t('camera.flip')}
                disabled={
                  !idle ||
                  switching ||
                  !recorder.ready ||
                  !canFlip ||
                  !!recorder.error ||
                  settings.mode === 'dual'
                }
                onPress={flipCamera}
              />
            </View>
          </View>
        </View>
      </View>
      <RecordingOptions
        mediaType={mediaType}
        recorder={recorder}
        visible={options}
        onClose={() => setOptions(false)}
      />
    </View>
  )
}
const createStyles = createThemedStyles((theme) => ({
  root: { flex: 1 },
  body: { flex: 1, gap: theme.spacing.md },
  bodyLandscape: { flexDirection: 'row' },
  toolbar: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  toolbarSide: { flex: 1, minWidth: 0, flexDirection: 'row' },
  toolbarActions: { justifyContent: 'flex-end', gap: theme.spacing.xs },
  panel: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  panelLandscape: {
    position: 'relative',
    bottom: 0,
    width: theme.spacing['9xl'] * 2 + theme.spacing['8xl'],
    justifyContent: 'center',
    paddingTop: theme.spacing['5xl'],
  },
  profile: {
    flexShrink: 1,
    paddingHorizontal: theme.spacing.md,
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
  notices: {
    position: 'absolute',
    bottom: theme.spacing['7xl'] + theme.spacing.sm,
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  noticesLandscape: { bottom: '50%', marginBottom: theme.spacing['3xl'] },
  controls: { flexDirection: 'row', alignItems: 'center' },
  controlGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    minWidth: 0,
  },
  controlButton: { width: theme.spacing['5xl'], flexShrink: 1 },
  zoom: {
    flexShrink: 1,
    width: theme.spacing['5xl'],
    height: theme.spacing['5xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  torch: {
    height: theme.spacing['5xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchUnavailable: { opacity: 0.2 },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.surface,
  },
  recordingDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.status.error,
  },
  timer: { flexShrink: 0, fontVariant: ['tabular-nums'] },
  record: {
    width: theme.spacing['7xl'],
    flexShrink: 0,
    height: theme.spacing['7xl'],
    borderRadius: theme.borderRadius.full,
    borderWidth: theme.spacing.xs,
    borderColor: cameraColors.shutter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: {
    width: theme.spacing['6xl'],
    height: theme.spacing['6xl'],
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.status.error,
  },
  photoShutter: { backgroundColor: cameraColors.shutter },
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
