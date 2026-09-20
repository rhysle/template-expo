import { Button, IconButton, Text } from '@shared/core/components/base'
import { BlurView } from 'expo-blur'
import {
  CameraRotateIcon,
  GearSixIcon,
  LightningIcon,
  LightningSlashIcon,
  RectangleIcon,
  SlidersHorizontalIcon,
  SquaresFourIcon,
  StackIcon,
} from 'phosphor-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Pressable, useWindowDimensions, View } from 'react-native'
import { cancelAnimation, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { formatDuration, type PreviewLayout, RESOLUTION_LABELS } from '@/services/camera/types'
import type { CaptureController } from '@/services/camera/useRecorder'
import { useCameraState } from '@/stores/features/camera'
import { cameraColors, createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { CameraStage } from './CameraStage'
import { FramingControl } from './FramingControl'
import { type QuickSettingsAction, QuickSettingsSheet } from './QuickSettingsSheet'

const LAYOUTS: PreviewLayout[] = ['pip', 'stacked', 'guide']
const LAYOUT_ICONS = { pip: SquaresFourIcon, stacked: StackIcon, guide: RectangleIcon }
const CAMERA_BLUR_INTENSITY = 20
export function CameraScreen({
  recorder,
  onSettings,
}: {
  recorder: CaptureController
  onSettings: () => void
}) {
  const { width, height } = useWindowDimensions()
  const landscape = width > height
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const cameraBlurProps = { tint: theme.appearance, intensity: CAMERA_BLUR_INTENSITY }
  const {
    sharedSettings,
    videoSettings,
    viewSettings,
    mediaType,
    lightEnabled,
    phase,
    setLightEnabled,
    setPreviewLayout,
    updateSharedSettings,
  } = useCameraState()
  const settings = useMemo(
    () => ({ ...sharedSettings, ...videoSettings }),
    [sharedSettings, videoSettings]
  )
  const layout = viewSettings.layout
  const [quickSettingsVisible, setQuickSettingsVisible] = useState(false)
  const [framingVisible, setFramingVisible] = useState(false)
  const pendingQuickAction = useRef<QuickSettingsAction | null>(null)
  const [flipTarget, setFlipTarget] = useState<boolean | null>(null)
  const [sessionTransitionVisible, setSessionTransitionVisible] = useState(false)
  const [toolbarHeight, setToolbarHeight] = useState<number>(theme.spacing['5xl'])
  const switchProgress = useSharedValue(0)
  const sessionSwitchProgress = useSharedValue(0)
  const switching = flipTarget !== null
  const transitionSwitching = switching || sessionTransitionVisible
  const transitionProgress = sessionTransitionVisible ? sessionSwitchProgress : switchProgress
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
    if (phase === 'switching') {
      setSessionTransitionVisible(true)
      sessionSwitchProgress.set(withTiming(1, { duration: 160 }))
      return
    }
    if (!sessionTransitionVisible) return
    sessionSwitchProgress.set(
      withDelay(
        120,
        withTiming(0, { duration: 220 }, (finished) => {
          if (finished) scheduleOnRN(setSessionTransitionVisible, false)
        })
      )
    )
  }, [phase, sessionTransitionVisible, sessionSwitchProgress])
  useEffect(() => () => cancelAnimation(sessionSwitchProgress), [sessionSwitchProgress])
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
    setFlipTarget(front)
    switchProgress.set(
      withTiming(1, { duration: 160 }, (finished) => {
        if (finished) scheduleOnRN(updateSharedSettings, { front, deviceId: null })
      })
    )
  }
  const openQuickSettings = () => {
    pendingQuickAction.current = null
    setFramingVisible(false)
    setQuickSettingsVisible(true)
  }
  const selectQuickAction = (action: QuickSettingsAction) => {
    pendingQuickAction.current = action
    setQuickSettingsVisible(false)
  }
  const finishQuickSettingsDismiss = () => {
    setQuickSettingsVisible(false)
    if (pendingQuickAction.current === 'framing') setFramingVisible(true)
    else if (pendingQuickAction.current === 'settings') onSettings()
    pendingQuickAction.current = null
  }
  const phaseLabels = {
    switching: t('camera.switchingMode'),
    preparing: t('camera.preparing'),
    finalizing: t('camera.finalizing'),
    exporting: t('camera.exporting'),
    capturing: t('camera.capturing'),
    idle: '',
    recording: '',
  }
  const permissionTitle = photoMode ? t('camera.photoPermissionTitle') : t('camera.permissionTitle')
  const permissionBody = photoMode ? t('camera.photoPermissionBody') : t('camera.permissionBody')
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
          <BlurView {...cameraBlurProps} style={styles.profile}>
            <Text variant="label" weight="semibold" numberOfLines={1}>
              {photoMode
                ? `${RESOLUTION_LABELS[settings.longEdge]} · JPEG · ${recorder.photoHdrEnabled ? 'HDR' : 'SDR'}`
                : `${RESOLUTION_LABELS[settings.longEdge]} · ${settings.fps}`}
            </Text>
          </BlurView>
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
          <BlurView {...cameraBlurProps} style={styles.controlBlur}>
            <IconButton
              icon={GearSixIcon}
              style={styles.controlButton}
              accessibilityLabel={t('camera.settings')}
              disabled={!idle || switching}
              onPress={onSettings}
            />
          </BlurView>
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
          switching={transitionSwitching}
          switchProgress={transitionProgress}
        />
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
                    openQuickSettings()
                  }}
                  label={t('camera.retry')}
                />
              </View>
            )}
          </View>
          <View style={styles.controls}>
            <View style={styles.controlGroup}>
              <BlurView {...cameraBlurProps} style={styles.controlBlur}>
                <Pressable
                  style={[
                    styles.controlButton,
                    styles.torch,
                    (switching ||
                      !recorder.ready ||
                      settings.mode === 'dual' ||
                      settings.front ||
                      !(photoMode ? recorder.device?.hasFlash : recorder.device?.hasTorch)) &&
                      styles.torchUnavailable,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    photoMode
                      ? t('camera.flashMode', {
                          mode: lightEnabled ? t('camera.flash.on') : t('camera.flash.off'),
                        })
                      : t('camera.torch')
                  }
                  accessibilityState={{ selected: lightEnabled }}
                  disabled={
                    switching ||
                    !recorder.ready ||
                    settings.mode === 'dual' ||
                    settings.front ||
                    !(photoMode ? recorder.device?.hasFlash : recorder.device?.hasTorch)
                  }
                  onPress={() => setLightEnabled(!lightEnabled)}>
                  {lightEnabled ? (
                    <LightningIcon
                      size={iconSizes.md}
                      weight="fill"
                      color={theme.colors.primary.main}
                    />
                  ) : (
                    <LightningSlashIcon size={iconSizes.md} color={theme.colors.text.primary} />
                  )}
                </Pressable>
              </BlurView>
              <BlurView {...cameraBlurProps} style={styles.controlBlur}>
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
              </BlurView>
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
              <BlurView {...cameraBlurProps} style={styles.controlBlur}>
                <IconButton
                  icon={SlidersHorizontalIcon}
                  style={styles.controlButton}
                  disabled={!idle || switching}
                  accessibilityLabel={t('camera.quickSettings')}
                  onPress={openQuickSettings}
                />
              </BlurView>
              <BlurView {...cameraBlurProps} style={styles.controlBlur}>
                <IconButton
                  icon={LAYOUT_ICONS[layout]}
                  style={styles.controlButton}
                  disabled={!idle || switching}
                  accessibilityLabel={t('camera.previewLayout', {
                    layout: layoutLabels[layout],
                  })}
                  onPress={() =>
                    setPreviewLayout(LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % LAYOUTS.length])
                  }
                />
              </BlurView>
              <BlurView {...cameraBlurProps} style={styles.controlBlur}>
                <IconButton
                  icon={CameraRotateIcon}
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
              </BlurView>
            </View>
          </View>
        </View>
      </View>
      {framingVisible && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('camera.closeFraming')}
            onPress={() => setFramingVisible(false)}
            style={styles.framingDismiss}
          />
          <FramingControl landscape={landscape} />
        </>
      )}
      <QuickSettingsSheet
        visible={quickSettingsVisible}
        onAction={selectQuickAction}
        onDismiss={finishQuickSettingsDismiss}
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
  framingDismiss: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 5,
  },
  profile: {
    flexShrink: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
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
  controlBlur: {
    width: theme.spacing['4xl'],
    height: theme.spacing['4xl'],
    flexShrink: 1,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  controlButton: {
    width: theme.spacing['4xl'],
    height: theme.spacing['4xl'],
    flexShrink: 1,
  },
  zoom: {
    flexShrink: 1,
    width: theme.spacing['4xl'],
    height: theme.spacing['4xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  torch: {
    height: theme.spacing['4xl'],
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
