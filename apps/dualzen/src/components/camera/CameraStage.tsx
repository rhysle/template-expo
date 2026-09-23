import { Text } from '@shared/core/components/base'
import { SpinArcLoader } from '@shared/core/components/base/Loader'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import type { PreviewLayout } from '@/services/camera/types'
import type { CaptureController } from '@/services/camera/useRecorder'
import { useCameraState } from '@/stores/features/camera'
import { cameraColors, createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { getLandscapeGuideFrame } from './cameraLayoutGeometry'
import { CAMERA_LAYOUT_TIMING } from './cameraLayoutTransition'
import { CameraPreview, type FocusPoint } from './CameraPreview'
import { CameraTransition } from './CameraTransition'

export function CameraStage({
  recorder,
  layout,
  edgeToEdgePortrait,
  topInset,
  bottomInset,
  switching,
  switchProgress,
  landscapeGuidePosition,
  children,
}: {
  recorder: CaptureController
  layout: PreviewLayout
  edgeToEdgePortrait: boolean
  topInset: number
  bottomInset: number
  switching: boolean
  switchProgress: SharedValue<number>
  landscapeGuidePosition: SharedValue<number>
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const { sharedSettings: settings, viewSettings, updatePipView } = useCameraState()
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const stageHeight = useSharedValue(0)
  const stageTop = useSharedValue(topInset)
  useEffect(() => {
    if (stage.height <= 0) return
    // Animate the preview viewport, not the stage or the controls anchored above it.
    const viewportHeight = Math.max(0, stage.height - topInset - bottomInset)
    stageTop.set(stageHeight.get() === 0 ? topInset : withTiming(topInset, CAMERA_LAYOUT_TIMING))
    stageHeight.set(
      stageHeight.get() === 0 ? viewportHeight : withTiming(viewportHeight, CAMERA_LAYOUT_TIMING)
    )
  }, [stage.height, topInset, bottomInset, stageHeight, stageTop])
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null)
  const pipX = useSharedValue(viewSettings.pip.x)
  const pipY = useSharedValue(viewSettings.pip.y)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const pipSize = useSharedValue(viewSettings.pip.size)
  const startSize = useSharedValue(viewSettings.pip.size)
  const restoreFraction = useSharedValue(0.4)
  useEffect(() => {
    pipX.set(viewSettings.pip.x)
    pipY.set(viewSettings.pip.y)
    pipSize.set(viewSettings.pip.size)
  }, [viewSettings.pip.x, viewSettings.pip.y, viewSettings.pip.size, pipX, pipY, pipSize])
  const stackedProgress = useSharedValue(layout === 'stacked' ? 1 : 0)
  const guideProgress = useSharedValue(layout === 'guide' ? 1 : 0)
  const landscapeOpacity = useSharedValue(layout === 'guide' ? 0 : 1)
  useEffect(() => {
    stackedProgress.set(withTiming(layout === 'stacked' ? 1 : 0, CAMERA_LAYOUT_TIMING))
    guideProgress.set(withTiming(layout === 'guide' ? 1 : 0, CAMERA_LAYOUT_TIMING))
    // Fade throughout the same movement, including the reverse transition from the guide to PiP.
    landscapeOpacity.set(withTiming(layout === 'guide' ? 0 : 1, CAMERA_LAYOUT_TIMING))
  }, [layout, stackedProgress, guideProgress, landscapeOpacity])
  const guideOpacity = useDerivedValue(() => guideProgress.value * (1 - landscapeOpacity.value))
  useEffect(
    () => () => {
      cancelAnimation(stackedProgress)
      cancelAnimation(guideProgress)
      cancelAnimation(landscapeOpacity)
      cancelAnimation(stageHeight)
      cancelAnimation(stageTop)
    },
    [stackedProgress, guideProgress, landscapeOpacity, stageHeight, stageTop]
  )
  useEffect(() => {
    if (!recorder.ready && recorder.phase !== 'switching') setFocusPoint(null)
  }, [recorder.ready, recorder.phase])
  const width = edgeToEdgePortrait
    ? stage.width
    : Math.min(stage.width, (Math.max(0, stage.height - topInset - bottomInset) * 9) / 16)
  const height = (width * 16) / 9
  const minSize = 0.4
  const maxSize = 0.75
  const padding = theme.spacing.sm * 2
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(layout === 'pip')
        .minDistance(12)
        .maxPointers(1)
        .onStart(() => {
          cancelAnimation(pipSize)
          startX.value = Math.max(0, Math.min(1, pipX.value))
          startY.value = Math.max(0, Math.min(1, pipY.value))
        })
        .onUpdate((event) => {
          if (stackedProgress.value !== 0 || guideProgress.value !== 0) return
          const size = Math.max(minSize, Math.min(maxSize, pipSize.value))
          const pipWidth = width * size
          const pipHeight = (pipWidth * 9) / 16
          const maxX = Math.max(0, width - pipWidth - padding)
          const maxY = Math.max(0, height - pipHeight - padding)
          pipX.value =
            maxX > 0
              ? Math.max(0, Math.min(1, startX.value + event.translationX / maxX))
              : startX.value
          pipY.value =
            maxY > 0
              ? Math.max(0, Math.min(1, startY.value + event.translationY / maxY))
              : startY.value
        })
        .onFinalize(() => {
          scheduleOnRN(updatePipView, { x: pipX.value, y: pipY.value })
        }),
    [
      startX,
      startY,
      pipX,
      pipY,
      pipSize,
      minSize,
      maxSize,
      width,
      height,
      padding,
      layout,
      stackedProgress,
      guideProgress,
      updatePipView,
    ]
  )
  const resize = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(layout === 'pip')
        .onStart(() => {
          cancelAnimation(pipSize)
          startSize.value = Math.max(minSize, Math.min(maxSize, pipSize.value))
        })
        .onUpdate((event) => {
          if (stackedProgress.value !== 0 || guideProgress.value !== 0) return
          pipSize.value = Math.max(minSize, Math.min(maxSize, startSize.value * event.scale))
        })
        .onFinalize(() => {
          scheduleOnRN(updatePipView, { size: pipSize.value })
        }),
    [startSize, pipSize, minSize, maxSize, layout, stackedProgress, guideProgress, updatePipView]
  )
  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(layout === 'pip')
        .numberOfTaps(2)
        .maxDuration(250)
        .maxDelay(280)
        .maxDistance(10)
        .onEnd((_event, success) => {
          if (!success || stackedProgress.value !== 0 || guideProgress.value !== 0 || width <= 0)
            return
          const current = Math.max(minSize, Math.min(maxSize, pipSize.value))
          const restore = current >= maxSize - 0.001
          if (!restore) restoreFraction.value = current
          const target = restore
            ? Math.max(minSize, Math.min(maxSize, restoreFraction.value))
            : maxSize
          pipSize.value = withTiming(target, { duration: 180 }, (finished) => {
            if (finished) scheduleOnRN(updatePipView, { size: target })
          })
        }),
    [
      width,
      minSize,
      maxSize,
      pipSize,
      restoreFraction,
      layout,
      stackedProgress,
      guideProgress,
      updatePipView,
    ]
  )
  // Native preview dimensions depend only on width, not on the toolbar/control layout.
  const previewWidth = stage.width
  const previewHeight = (previewWidth * 16) / 9
  const landscapeHeight = (previewWidth * 9) / 16
  const guideSource = settings.mode === 'single' ? recorder.stats.source0 : recorder.stats.source1
  const geometry = useDerivedValue(() => {
    const viewportHeight = stageHeight.value
    const portraitWidth = edgeToEdgePortrait
      ? stage.width
      : Math.min(stage.width, (viewportHeight * 9) / 16)
    const stackedWidth = Math.max(
      0,
      Math.min(stage.width, (viewportHeight - theme.spacing.md) / (9 / 16 + (0.58 * 16) / 9))
    )
    const stackedLandscapeHeight = (stackedWidth * 9) / 16
    const stackedPortraitHeight = (stackedWidth * 0.58 * 16) / 9
    const portraitHeight = (portraitWidth * 16) / 9
    const portraitTop = edgeToEdgePortrait
      ? stageTop.value
      : stageTop.value + (viewportHeight - portraitHeight) / 2
    const guide = getLandscapeGuideFrame(
      portraitWidth,
      portraitHeight,
      landscapeGuidePosition.value,
      guideSource
    )
    return {
      viewportTop: stageTop.value,
      viewportHeight,
      portraitWidth,
      portraitHeight,
      portraitTop,
      guideCenterY: portraitTop + guide.top + guide.height / 2,
      stackedWidth,
      stackedLandscapeHeight,
      stackedPortraitHeight,
      stackedTop:
        stageTop.value +
        (viewportHeight - stackedLandscapeHeight - theme.spacing.md - stackedPortraitHeight) / 2,
    }
  })
  const portraitStyle = useAnimatedStyle(() => {
    const frame = geometry.value
    const progress = stackedProgress.value
    const renderedWidth = interpolate(
      progress,
      [0, 1],
      [frame.portraitWidth, frame.stackedWidth * 0.58]
    )
    const scale = previewWidth > 0 ? renderedWidth / previewWidth : 1
    const centerY = interpolate(
      progress,
      [0, 1],
      [
        frame.portraitTop + frame.portraitHeight / 2,
        frame.stackedTop +
          frame.stackedLandscapeHeight +
          theme.spacing.md +
          frame.stackedPortraitHeight / 2,
      ]
    )
    return {
      borderRadius: theme.borderRadius.xl / Math.max(scale, 0.001),
      transform: [{ translateY: centerY - previewHeight / 2 }, { scale }],
    }
  })
  const insetStyle = useAnimatedStyle(() => {
    const frame = geometry.value
    const stackedWeight = stackedProgress.value
    const guideWeight = guideProgress.value
    const pipWeight = Math.max(0, 1 - stackedWeight - guideWeight)
    const normalizedSize = Math.max(minSize, Math.min(maxSize, pipSize.value))
    const pipWidth = frame.portraitWidth * normalizedSize
    const pipHeight = (pipWidth * 9) / 16
    const maxX = Math.max(0, frame.portraitWidth - pipWidth - padding)
    const maxY = Math.max(0, frame.portraitHeight - pipHeight - padding)
    const pipCenterX =
      (stage.width + frame.portraitWidth) / 2 -
      theme.spacing.sm -
      pipWidth / 2 +
      (Math.max(0, Math.min(1, pipX.value)) - 1) * maxX
    const pipCenterY =
      frame.portraitTop +
      frame.portraitHeight -
      theme.spacing.sm -
      pipHeight / 2 +
      (Math.max(0, Math.min(1, pipY.value)) - 1) * maxY
    // Blend three exact endpoints, rather than routing the Single mode transition through PiP.
    const renderedWidth =
      pipWidth * pipWeight + frame.stackedWidth * stackedWeight + frame.portraitWidth * guideWeight
    const centerX = pipCenterX * pipWeight + (stage.width / 2) * (stackedWeight + guideWeight)
    const centerY =
      pipCenterY * pipWeight +
      (frame.stackedTop + frame.stackedLandscapeHeight / 2) * stackedWeight +
      frame.guideCenterY * guideWeight
    const scale = previewWidth > 0 ? renderedWidth / previewWidth : 1
    return {
      opacity: landscapeOpacity.value,
      borderRadius:
        (theme.borderRadius.sm * pipWeight + theme.borderRadius.xl * stackedWeight) /
        Math.max(scale, 0.001),
      borderWidth: pipWeight / Math.max(scale, 0.001),
      transform: [
        {
          translateX: centerX - previewWidth / 2,
        },
        {
          translateY: centerY - landscapeHeight / 2,
        },
        { scale },
      ],
    }
  })
  const feedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + switchProgress.value * 0.025 }],
  }))
  const dismissFocus = (id: number) =>
    setFocusPoint((current) => (current?.id === id ? null : current))
  const previewProps = {
    recorder,
    focusPoint,
    onFocusPoint: setFocusPoint,
    onDismissFocus: dismissFocus,
    showGrid: layout !== 'guide',
  }
  return (
    <View style={styles.stage} onLayout={(event) => setStage(event.nativeEvent.layout)}>
      <Animated.View style={[styles.feed, feedStyle]}>
        {(recorder.configured || switching) && stage.width > 0 && stage.height > 0 ? (
          <>
            {/* Stable native surfaces: only their wrappers move and scale between layouts. */}
            <Animated.View
              style={[
                styles.previewFrame,
                { width: previewWidth, height: previewHeight },
                portraitStyle,
              ]}>
              <CameraPreview
                {...previewProps}
                kind="portrait"
                width={previewWidth}
                height={previewHeight}
                guideOpacity={guideOpacity}
                guidePosition={landscapeGuidePosition}
                embedded
              />
            </Animated.View>
            <Animated.View
              pointerEvents={layout === 'guide' ? 'none' : 'auto'}
              style={[
                styles.previewFrame,
                styles.inset,
                { width: previewWidth, height: landscapeHeight },
                insetStyle,
              ]}>
              <CameraPreview
                {...previewProps}
                kind="landscape"
                width={previewWidth}
                height={landscapeHeight}
                embedded
                pinchGesture={layout === 'pip' ? resize : undefined}
                doubleTapGesture={layout === 'pip' ? doubleTap : undefined}
                meteringEnabled={layout === 'stacked'}
                drag={layout === 'pip' ? pan : undefined}
              />
            </Animated.View>
          </>
        ) : !recorder.error ? (
          <View style={styles.waiting}>
            <SpinArcLoader color={theme.colors.primary.main} />
            <Text tone="secondary">
              {recorder.device ? t('camera.waiting') : t('camera.noCamera')}
            </Text>
          </View>
        ) : null}
      </Animated.View>
      {switching && <CameraTransition progress={switchProgress} />}
      {children}
      {recorder.focusLocked && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('camera.unlockFocus')}
          onPress={() => {
            setFocusPoint(null)
            void recorder.unlockFocus()
          }}
          style={styles.lock}>
          <Text variant="caption" style={styles.lockText}>
            {t('camera.focusLock')}
          </Text>
        </Pressable>
      )}
    </View>
  )
}
const createStyles = createThemedStyles((theme) => ({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  feed: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  previewFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  inset: {
    borderColor: theme.colors.border.strong,
  },
  waiting: { alignItems: 'center', gap: theme.spacing.md },
  lock: {
    position: 'absolute',
    top: theme.spacing['6xl'],
    alignSelf: 'center',
    backgroundColor: theme.colors.background.overlay,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
  },
  lockText: { color: cameraColors.focus },
}))
