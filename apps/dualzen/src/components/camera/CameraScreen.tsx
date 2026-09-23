import {
  Button,
  IconButton,
  NativeMenu,
  type NativeMenuAction,
  Text,
} from '@shared/core/components/base'
import { recordError } from '@shared/core/services/sentry'
import { withAlpha } from '@shared/core/utils/color'
import { BlurView } from 'expo-blur'
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect'
import {
  CheckSquareIcon,
  GearSixIcon,
  LightningIcon,
  LightningSlashIcon,
  RectangleIcon,
  SlidersHorizontalIcon,
  SquareIcon,
  SquaresFourIcon,
  StackIcon,
  XSquareIcon,
} from 'phosphor-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AccessibilityInfo,
  Linking,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import type { PermissionStatus } from 'react-native-vision-camera'
import { scheduleOnRN } from 'react-native-worklets'

import type { CaptureContextController } from '@/services/camera/CaptureProvider'
import {
  formatDuration,
  formatFilmingTime,
  FPS_OPTIONS,
  type PreviewLayout,
  type RecordingSettings,
  RESOLUTION_LABELS,
  RESOLUTION_OPTIONS,
  RESOLUTION_SHORT_LABELS,
} from '@/services/camera/types'
import { useCameraState } from '@/stores/features/camera'
import { cameraColors, createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { CameraStage } from './CameraStage'
import { FramingControl } from './FramingControl'
import { type QuickSettingsAction, QuickSettingsSheet } from './QuickSettingsSheet'

const LAYOUTS: PreviewLayout[] = ['pip', 'stacked', 'guide']
const LAYOUT_ICONS = { pip: SquaresFourIcon, stacked: StackIcon, guide: RectangleIcon }
const CAMERA_BLUR_INTENSITY = 20
const RECORD_MORPH_DURATION = 240

function PermissionRow({
  label,
  prompted,
  status,
}: {
  label: string
  prompted: boolean
  status: PermissionStatus
}) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()
  const authorized = status === 'authorized'
  const denied = status === 'denied' || status === 'restricted' || prompted
  const stateLabel = authorized
    ? t('camera.permissionGranted')
    : denied
      ? t('camera.permissionDenied')
      : t('camera.permissionNotRequested')
  const StatusIcon = authorized ? CheckSquareIcon : denied ? XSquareIcon : SquareIcon
  const color = authorized ? colors.primary.main : denied ? colors.status.error : colors.text.muted

  return (
    <View accessible accessibilityLabel={`${label}: ${stateLabel}`} style={styles.permissionRow}>
      <Text variant="subtitle" weight="medium">
        {label}
      </Text>
      <StatusIcon
        aria-hidden
        color={color}
        size={iconSizes.md}
        weight={authorized || denied ? 'fill' : 'regular'}
      />
    </View>
  )
}

export function CameraScreen({
  recorder,
  onSettings,
}: {
  recorder: CaptureContextController
  onSettings: () => void
}) {
  const { width, height } = useWindowDimensions()
  const landscape = width > height
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const cameraBlurProps = { tint: theme.appearance, intensity: CAMERA_BLUR_INTENSITY }
  const [reduceTransparency, setReduceTransparency] = useState(true)
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
    updateVideoSettings,
  } = useCameraState()
  const settings = useMemo(
    () => ({ ...sharedSettings, ...videoSettings }),
    [sharedSettings, videoSettings]
  )
  const capabilitySettings = useMemo<RecordingSettings>(
    () => ({
      longEdge: sharedSettings.longEdge,
      fps: videoSettings.fps,
      container: videoSettings.container,
      hdr: videoSettings.hdr,
      stabilization: videoSettings.stabilization,
      mode: sharedSettings.mode,
      front: sharedSettings.front,
      deviceId: sharedSettings.deviceId,
      pairIndex: sharedSettings.pairIndex,
      // Capability checks ignore crop, grid, and output-mirroring preferences. Keep these
      // fields fixed so changing them doesn't invalidate the checks below.
      portraitPosition: 0.5,
      landscapePosition: 0.5,
      grid: false,
      mirrorFrontCamera: false,
    }),
    [
      sharedSettings.deviceId,
      sharedSettings.front,
      sharedSettings.longEdge,
      sharedSettings.mode,
      sharedSettings.pairIndex,
      videoSettings.container,
      videoSettings.fps,
      videoSettings.hdr,
      videoSettings.stabilization,
    ]
  )
  const layout = viewSettings.layout
  const { checkSettings } = recorder
  const [supported, setSupported] = useState<Record<string, boolean>>({})
  const [quickSettingsVisible, setQuickSettingsVisible] = useState(false)
  const [framingVisible, setFramingVisible] = useState(false)
  const pendingQuickAction = useRef<QuickSettingsAction | null>(null)
  const [sessionTransitionVisible, setSessionTransitionVisible] = useState(false)
  const [toolbarHeight, setToolbarHeight] = useState<number>(theme.spacing['5xl'])
  const sessionSwitchProgress = useSharedValue(0)
  const landscapeGuidePosition = useSharedValue(settings.landscapePosition)
  useEffect(() => {
    landscapeGuidePosition.set(settings.landscapePosition)
  }, [landscapeGuidePosition, settings.landscapePosition])
  const switching = recorder.flipping
  const transitionSwitching = switching || sessionTransitionVisible
  const transitionProgress = sessionTransitionVisible
    ? sessionSwitchProgress
    : recorder.flipProgress
  useEffect(() => {
    if (Platform.OS !== 'ios') return
    let active = true
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (active) setReduceTransparency(value)
      })
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    )
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
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
  useEffect(() => {
    let cancelled = false
    setSupported({})
    const variants = [
      ...FPS_OPTIONS.map((fps) => ({
        key: `fps${fps}`,
        settings: { ...capabilitySettings, fps },
      })),
      ...RESOLUTION_OPTIONS.map((longEdge) => ({
        key: `edge${longEdge}`,
        settings: { ...capabilitySettings, longEdge },
      })),
    ]
    void Promise.all(
      variants.map(async (variant) => [variant.key, await checkSettings(variant.settings)] as const)
    ).then((values) => {
      if (!cancelled) setSupported(Object.fromEntries(values))
    })
    return () => {
      cancelled = true
    }
  }, [capabilitySettings, checkSettings])
  const idle = phase === 'idle'
  const photoMode = mediaType === 'photo'
  const immersive = layout === 'guide' && !landscape
  const recording = phase === 'recording'
  const recordCircleSize = theme.spacing['6xl']
  const recordStopSize = theme.spacing['3xl']
  const recordMorphProgress = useSharedValue(recording ? 1 : 0)
  useEffect(() => {
    recordMorphProgress.set(
      withTiming(recording ? 1 : 0, {
        duration: RECORD_MORPH_DURATION,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      })
    )
  }, [recording, recordMorphProgress])
  useEffect(() => () => cancelAnimation(recordMorphProgress), [recordMorphProgress])
  const recordShapeStyle = useAnimatedStyle(() => {
    const size = interpolate(recordMorphProgress.value, [0, 1], [recordCircleSize, recordStopSize])

    return {
      width: size,
      height: size,
      borderRadius: interpolate(
        recordMorphProgress.value,
        [0, 1],
        [recordCircleSize / 2, theme.borderRadius.sm]
      ),
    }
  })
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
  const liquidGlass =
    Platform.OS === 'ios' &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable()
  const recordColor = photoMode ? cameraColors.shutter : theme.colors.status.error
  const recordInnerStyle = [
    styles.recordInner,
    { backgroundColor: withAlpha(recordColor, photoMode ? 0.88 : 0.78) },
    recordShapeStyle,
  ]
  const recordSurface = liquidGlass ? (
    <GlassView
      colorScheme={theme.appearance}
      glassEffectStyle="regular"
      tintColor={withAlpha(theme.colors.background.surface, 0.2)}
      isInteractive
      pointerEvents="none"
      style={styles.recordSurface}>
      <Animated.View style={recordInnerStyle} />
    </GlassView>
  ) : (
    <BlurView {...cameraBlurProps} pointerEvents="none" style={styles.recordSurface}>
      <Animated.View style={recordInnerStyle} />
    </BlurView>
  )
  const qualityMenuActions = useMemo<readonly NativeMenuAction[]>(() => {
    const actions: NativeMenuAction[] = [
      {
        id: 'resolution',
        label: RESOLUTION_LABELS[settings.longEdge],
        children: RESOLUTION_OPTIONS.map((longEdge) => ({
          id: `resolution:${longEdge}`,
          label: RESOLUTION_LABELS[longEdge],
          disabled: supported[`edge${longEdge}`] !== true,
          selected: longEdge === settings.longEdge,
        })),
      },
    ]
    if (!photoMode) {
      actions.push({
        id: 'fps',
        label: `${settings.fps} FPS`,
        children: FPS_OPTIONS.map((fps) => ({
          id: `fps:${fps}`,
          label: String(fps),
          disabled: supported[`fps${fps}`] !== true,
          selected: fps === settings.fps,
        })),
      })
    }
    return actions
  }, [photoMode, settings.fps, settings.longEdge, supported])
  const selectQualityMenuAction = (id: string) => {
    if (id.startsWith('resolution:')) {
      const longEdge = Number(id.slice('resolution:'.length))
      if (RESOLUTION_OPTIONS.includes(longEdge as (typeof RESOLUTION_OPTIONS)[number]))
        updateSharedSettings({ longEdge: longEdge as RecordingSettings['longEdge'] })
    } else if (id.startsWith('fps:')) {
      const fps = Number(id.slice('fps:'.length))
      if (FPS_OPTIONS.includes(fps as (typeof FPS_OPTIONS)[number]))
        updateVideoSettings({ fps: fps as RecordingSettings['fps'] })
    }
  }
  const qualityMenuEnabled = idle && !switching
  const dynamicRange = photoMode
    ? recorder.photoHdrEnabled
      ? 'HDR'
      : 'SDR'
    : settings.hdr
      ? 'HDR'
      : 'SDR'
  const profileLabel = photoMode
    ? `${t('camera.resolution')}: ${RESOLUTION_LABELS[settings.longEdge]}, ${t('camera.format')}: JPEG, ${dynamicRange}`
    : `${t('camera.resolution')}: ${RESOLUTION_LABELS[settings.longEdge]}, ${t('camera.fps')}: ${settings.fps}, ${dynamicRange}`
  const profile = (
    <BlurView
      {...cameraBlurProps}
      accessible
      accessibilityRole="button"
      accessibilityLabel={profileLabel}
      accessibilityState={{ disabled: !qualityMenuEnabled }}
      style={styles.profile}>
      <Text variant="label" weight="semibold" numberOfLines={1}>
        {photoMode
          ? `${RESOLUTION_SHORT_LABELS[settings.longEdge]} · JPEG · ${dynamicRange}`
          : `${RESOLUTION_SHORT_LABELS[settings.longEdge]} · ${settings.fps} · ${dynamicRange}`}
      </Text>
    </BlurView>
  )
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
  if (!recorder.authorized) {
    const canRequestPermission =
      recorder.cameraPermissionCanRequest || recorder.microphonePermissionCanRequest
    return (
      <View style={styles.permission}>
        <Text variant="title" weight="bold" align="center">
          {t('camera.permissionTitle')}
        </Text>
        <Text tone="secondary" align="center">
          {t('camera.permissionBody')}
        </Text>
        <View style={styles.permissionRows}>
          <PermissionRow
            label={t('camera.cameraPermission')}
            prompted={recorder.cameraPermissionPrompted}
            status={recorder.cameraPermissionStatus}
          />
          <PermissionRow
            label={t('camera.microphonePermission')}
            prompted={recorder.microphonePermissionPrompted}
            status={recorder.microphonePermissionStatus}
          />
        </View>
        <Button
          fullWidth
          loading={recorder.capturePermissionsRequesting}
          onPress={() => {
            if (canRequestPermission) void recorder.requestCapturePermissions()
            else
              void Linking.openSettings().catch((cause) => {
                recordError(cause, 'permissions.openSettings', { platform: Platform.OS })
              })
          }}
          label={canRequestPermission ? t('camera.allowAccess') : t('camera.openSettings')}
        />
      </View>
    )
  }
  return (
    <View style={styles.root}>
      <View
        style={styles.toolbar}
        onLayout={(event) => setToolbarHeight(event.nativeEvent.layout.height)}>
        <View style={styles.toolbarSide}>
          {qualityMenuEnabled ? (
            <NativeMenu
              actions={qualityMenuActions}
              footer={t('camera.remaining', { time: formatFilmingTime(recorder.remaining) })}
              onSelect={selectQualityMenuAction}
              style={styles.profileMenu}>
              {profile}
            </NativeMenu>
          ) : (
            profile
          )}
        </View>
        {recording && (
          <BlurView {...cameraBlurProps} style={styles.timerPill}>
            <View style={styles.recordingDot} />
            <Text weight="semibold" style={styles.timer}>
              {formatDuration(recorder.elapsed)}
            </Text>
          </BlurView>
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
          landscapeGuidePosition={landscapeGuidePosition}
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
              {recordSurface}
            </Pressable>
            <View style={[styles.controlGroup, styles.trailingControlGroup]}>
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
                  icon={SlidersHorizontalIcon}
                  style={styles.controlButton}
                  disabled={!idle || switching}
                  accessibilityLabel={t('camera.quickSettings')}
                  onPress={openQuickSettings}
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
          <FramingControl
            landscape={landscape}
            deferLandscapeChange={layout === 'guide'}
            landscapeGuidePosition={landscapeGuidePosition}
          />
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
  profileMenu: { flexShrink: 1 },
  permission: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing['4xl'],
    gap: theme.spacing.xl,
  },
  permissionRows: {
    gap: theme.spacing.sm,
  },
  permissionRow: {
    minHeight: theme.spacing['4xl'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background.surface,
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
  trailingControlGroup: {
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
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
    overflow: 'hidden',
  },
  recordingDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.status.error,
  },
  timer: { flexShrink: 0, fontVariant: ['tabular-nums'] },
  record: {
    width: theme.spacing['6xl'] + theme.spacing.md,
    flexShrink: 0,
    height: theme.spacing['6xl'] + theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordSurface: {
    width: theme.spacing['6xl'] + theme.spacing.md,
    height: theme.spacing['6xl'] + theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: {
    width: theme.spacing['6xl'],
    height: theme.spacing['6xl'],
    borderRadius: theme.borderRadius.full,
  },
  dim: { opacity: 0.4 },
  error: {
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius.md,
  },
}))
