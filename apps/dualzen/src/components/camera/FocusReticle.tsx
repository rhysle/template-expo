import { withAlpha } from '@shared/core/utils/color'
import { SunIcon } from 'phosphor-react-native'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import type { OutputKind } from '@/services/camera/types'
import type { RecorderController } from '@/services/camera/useRecorder'
import { cameraColors, createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import type { FocusPoint } from './CameraPreview'

const FOCUS_IDLE_MS = 3000
const EXPOSURE_UPDATE_MS = 40
const armFade = (
  opacity: SharedValue<number>,
  dismissHandler: SharedValue<{ callback: (id: number) => void }>,
  id: number
) => {
  'worklet'
  opacity.value = withDelay(
    FOCUS_IDLE_MS,
    withTiming(0, { duration: 250 }, (finished) => {
      if (finished) scheduleOnRN(dismissHandler.value.callback, id)
    }),
    ReduceMotion.Never
  )
}

export function FocusReticle({
  recorder,
  kind,
  width,
  height,
  point,
  blockers,
  onDismiss,
}: {
  recorder: RecorderController
  kind: OutputKind
  width: number
  height: number
  point: FocusPoint
  blockers: GestureType[]
  onDismiss: (id: number) => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const range = recorder.exposureRange(kind)
  const bias = recorder.exposureBias[kind]
  const opacity = useSharedValue(1)
  const visualBias = useSharedValue(bias)
  const startBias = useSharedValue(bias)
  const pendingBias = useSharedValue<number | null>(null)
  const dragging = useSharedValue(false)
  const lastSentAt = useSharedValue(0)
  const lastRequestedBias = useSharedValue(bias)
  const exposureHandler = useSharedValue({ callback: recorder.exposure })
  const dismissHandler = useSharedValue({ callback: onDismiss })
  const boxSize = Math.min(theme.spacing['6xl'], width / 3, height / 3)
  const boxX = Math.max(0, Math.min(width - boxSize, point.x * width - boxSize / 2))
  const boxY = Math.max(0, Math.min(height - boxSize, point.y * height - boxSize / 2))
  const hitSize = Math.min(theme.spacing['4xl'], width / 3, height / 2)
  const sunX = Math.max(
    hitSize / 2,
    Math.min(
      width - hitSize / 2,
      boxX + boxSize + theme.spacing['3xl'] > width
        ? boxX - theme.spacing.lg
        : boxX + boxSize + theme.spacing.lg
    )
  )
  const trackHeight = Math.max(
    1,
    Math.min(theme.spacing['8xl'], height - hitSize - theme.spacing.sm * 2)
  )
  const trackTop = Math.max(
    hitSize / 2,
    Math.min(height - trackHeight - hitSize / 2, boxY + boxSize / 2 - trackHeight / 2)
  )
  const span = Math.max(0.001, range.max - range.min)
  const sunSize = height < theme.spacing['8xl'] ? iconSizes.sm : iconSizes.md

  useEffect(() => {
    exposureHandler.value = { callback: recorder.exposure }
    dismissHandler.value = { callback: onDismiss }
  }, [recorder.exposure, onDismiss, exposureHandler, dismissHandler])
  useEffect(() => {
    // Ignore older native acknowledgements while the finger is moving or a newer value is queued.
    if (
      !dragging.value &&
      (pendingBias.value === null || Math.abs(pendingBias.value - bias) < 0.001)
    ) {
      visualBias.value = bias
      pendingBias.value = null
    }
  }, [bias, dragging, pendingBias, visualBias])
  useEffect(() => {
    armFade(opacity, dismissHandler, point.id)
    return () => cancelAnimation(opacity)
  }, [opacity, dismissHandler, point.id])

  // Keep the native handler attached while native exposure acknowledgements re-render the camera.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(range.supported)
        .maxPointers(1)
        .minDistance(0)
        .blocksExternalGesture(...blockers)
        .onTouchesDown((_event, manager) => {
          if (opacity.value < 0.05) manager.fail()
        })
        .onBegin(() => {
          dragging.value = true
          cancelAnimation(opacity)
          opacity.value = 1
          startBias.value = visualBias.value
          lastSentAt.value = 0
        })
        .onUpdate((event) => {
          const value = Math.max(
            range.min,
            Math.min(range.max, startBias.value - (event.translationY / trackHeight) * span)
          )
          // Thumb movement follows every UI frame; hardware updates are independently rate-limited.
          visualBias.value = value
          pendingBias.value = value
        })
        .onFinalize(() => {
          if (!dragging.value) return
          dragging.value = false
          pendingBias.value = visualBias.value
          scheduleOnRN(exposureHandler.value.callback, visualBias.value, kind)
          armFade(opacity, dismissHandler, point.id)
        }),
    [
      range.supported,
      range.min,
      range.max,
      blockers,
      opacity,
      dragging,
      startBias,
      visualBias,
      lastSentAt,
      pendingBias,
      trackHeight,
      span,
      exposureHandler,
      kind,
      dismissHandler,
      point.id,
    ]
  )

  // Preserve the UI frame scheduler while camera state acknowledges exposure updates.
  useFrameCallback(
    useCallback(
      ({ timestamp }: { timestamp: number }) => {
        'worklet'
        if (
          !dragging.value ||
          timestamp - lastSentAt.value < EXPOSURE_UPDATE_MS ||
          visualBias.value === lastRequestedBias.value
        )
          return
        lastSentAt.value = timestamp
        lastRequestedBias.value = visualBias.value
        scheduleOnRN(exposureHandler.value.callback, visualBias.value, kind)
      },
      [dragging, lastSentAt, visualBias, lastRequestedBias, exposureHandler, kind]
    )
  )

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ((range.max - visualBias.value) / span) * trackHeight }],
  }))
  const upperRailStyle = useAnimatedStyle(() => ({
    height: Math.max(
      0,
      ((range.max - visualBias.value) / span) * trackHeight - sunSize / 2 - theme.spacing.xs
    ),
  }))
  const lowerRailStyle = useAnimatedStyle(() => ({
    top: Math.min(
      trackHeight,
      ((range.max - visualBias.value) / span) * trackHeight + sunSize / 2 + theme.spacing.xs
    ),
  }))
  return (
    <Animated.View pointerEvents="box-none" style={[styles.fill, overlayStyle]}>
      <View
        pointerEvents="none"
        style={[styles.focus, { width: boxSize, height: boxSize, left: boxX, top: boxY }]}
      />
      {range.supported && (
        <>
          <View
            pointerEvents="none"
            style={[styles.railContainer, { left: sunX, top: trackTop, height: trackHeight }]}>
            <Animated.View style={[styles.rail, upperRailStyle]} />
            <Animated.View style={[styles.rail, styles.lowerRail, lowerRailStyle]} />
          </View>
          <GestureDetector gesture={pan}>
            <Animated.View
              collapsable={false}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={t('camera.exposure')}
              accessibilityValue={{ min: range.min, max: range.max, now: bias }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={({ nativeEvent }) => {
                if (
                  nativeEvent.actionName !== 'increment' &&
                  nativeEvent.actionName !== 'decrement'
                )
                  return
                cancelAnimation(opacity)
                opacity.value = 1
                void recorder.exposure(
                  Math.max(
                    range.min,
                    Math.min(
                      range.max,
                      bias + (nativeEvent.actionName === 'increment' ? 0.1 : -0.1)
                    )
                  ),
                  kind
                )
                armFade(opacity, dismissHandler, point.id)
              }}
              style={[
                styles.thumb,
                {
                  left: sunX - hitSize / 2,
                  top: trackTop - hitSize / 2,
                  width: hitSize,
                  height: hitSize,
                },
                thumbStyle,
              ]}>
              <SunIcon size={sunSize} color={cameraColors.focus} weight="fill" />
            </Animated.View>
          </GestureDetector>
        </>
      )}
    </Animated.View>
  )
}
const createStyles = createThemedStyles((theme) => ({
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  focus: { position: 'absolute', borderWidth: 1.5, borderColor: cameraColors.focus },
  railContainer: { position: 'absolute', width: 1 },
  rail: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: withAlpha(cameraColors.focus, 0.65),
  },
  lowerRail: { bottom: 0 },
  thumb: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
}))
