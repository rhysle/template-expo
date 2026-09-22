import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { getNativeCropPosition } from '@/services/camera/cropPosition'
import type { OutputKind } from '@/services/camera/types'
import type { CaptureController } from '@/services/camera/useRecorder'
import { useCameraState } from '@/stores/features/camera'
import { createThemedStyles, useThemedStyles } from '@/theme'

import { DualRecorderPreview } from '../../../modules/dual-recorder/src/DualRecorderModule'
import { getLandscapeGuideFrame } from './cameraLayoutGeometry'
import { FocusReticle } from './FocusReticle'

const GUIDE_CORNER_STROKE_WIDTH = 2
const GUIDE_CORNER_OFFSET = -(GUIDE_CORNER_STROKE_WIDTH / 2)

export type FocusPoint = { id: number; kind: OutputKind; x: number; y: number }

export function CameraPreview({
  recorder,
  kind,
  width,
  height,
  focusPoint,
  onFocusPoint,
  onDismissFocus,
  guide = false,
  guideOpacity,
  guidePosition,
  showGrid = true,
  meteringEnabled = true,
  embedded = false,
  pinchGesture,
  doubleTapGesture,
  drag,
}: {
  recorder: CaptureController
  kind: OutputKind
  width: number
  height: number
  focusPoint: FocusPoint | null
  onFocusPoint: (point: FocusPoint | null) => void
  onDismissFocus: (id: number) => void
  guide?: boolean
  guideOpacity?: SharedValue<number>
  guidePosition?: SharedValue<number>
  showGrid?: boolean
  meteringEnabled?: boolean
  embedded?: boolean
  pinchGesture?: ReturnType<typeof Gesture.Pinch>
  doubleTapGesture?: ReturnType<typeof Gesture.Tap>
  drag?: ReturnType<typeof Gesture.Pan>
}) {
  const { sharedSettings: settings } = useCameraState()
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const pinchStart = useSharedValue(1)
  const lastZoom = useSharedValue(1)
  const { min: zoomMin, max: zoomMax } = recorder.zoomRange
  const point = meteringEnabled && focusPoint?.kind === kind ? focusPoint : null
  const meterHandler = useSharedValue({
    callback: async (_x: number, _y: number, _locked: boolean) => {},
  })
  useEffect(() => {
    meterHandler.value = {
      callback: async (x: number, y: number, locked: boolean) => {
        if (!meteringEnabled || width <= 0 || height <= 0) return
        if (!locked && recorder.focusLocked) {
          onFocusPoint(null)
          await recorder.unlockFocus()
          return
        }
        const normalized = {
          id: Date.now(),
          kind,
          x: Math.max(0, Math.min(1, x / width)),
          y: Math.max(0, Math.min(1, y / height)),
        }
        onFocusPoint(normalized)
        const source =
          settings.mode === 'dual'
            ? kind === 'portrait'
              ? recorder.stats.source1
              : recorder.stats.source2
            : recorder.stats.source0
        if (!source) return
        const ratio = kind === 'portrait' ? 9 / 16 : 16 / 9
        const cropWidth = Math.min(source.width, source.height * ratio)
        const cropHeight = Math.min(source.height, source.width / ratio)
        const position =
          kind === 'portrait' ? settings.portraitPosition : settings.landscapePosition
        const nativePosition = getNativeCropPosition(kind, position, settings.front)
        await recorder.focus(
          ((source.width - cropWidth) * nativePosition +
            (settings.front ? 1 - normalized.x : normalized.x) * cropWidth) /
            source.width,
          ((source.height - cropHeight) * nativePosition + normalized.y * cropHeight) /
            source.height,
          kind,
          locked
        )
      },
    }
  }, [meteringEnabled, width, height, recorder, settings, kind, onFocusPoint, meterHandler])
  const zoomHandler = useSharedValue({ callback: recorder.setZoom })
  const currentZoom = useSharedValue(recorder.zoom)
  useEffect(() => {
    zoomHandler.value = { callback: recorder.setZoom }
    currentZoom.value = recorder.zoom
  }, [recorder.setZoom, recorder.zoom, zoomHandler, currentZoom])
  // Native exposure updates must not detach the active focus, zoom, or PiP handlers.
  const { gestures, blockers } = useMemo(() => {
    const tap = Gesture.Tap()
      .enabled(meteringEnabled)
      .maxDistance(10)
      .onEnd((event, success) => {
        if (success) scheduleOnRN(meterHandler.value.callback, event.x, event.y, false)
      })
    const hold = Gesture.LongPress()
      .enabled(meteringEnabled)
      .minDuration(650)
      .maxDistance(10)
      .onStart((event) => {
        scheduleOnRN(meterHandler.value.callback, event.x, event.y, true)
      })
    const zoomPinch = Gesture.Pinch()
      .onStart(() => {
        pinchStart.value = currentZoom.value
        lastZoom.value = currentZoom.value
      })
      .onUpdate((event) => {
        const value = Math.max(zoomMin, Math.min(zoomMax, pinchStart.value * event.scale))
        if (Math.abs(value - lastZoom.value) < 0.035) return
        lastZoom.value = value
        scheduleOnRN(zoomHandler.value.callback, value)
      })
      .onEnd((event) => {
        scheduleOnRN(
          zoomHandler.value.callback,
          Math.max(zoomMin, Math.min(zoomMax, pinchStart.value * event.scale))
        )
      })
    const pinch = pinchGesture ?? zoomPinch
    const metering = doubleTapGesture ?? Gesture.Exclusive(hold, tap)
    return {
      gestures: drag ? Gesture.Race(pinch, drag, metering) : Gesture.Race(pinch, metering),
      blockers: drag ? [tap, hold, pinch, drag] : [tap, hold, pinch],
    }
  }, [
    meteringEnabled,
    pinchGesture,
    doubleTapGesture,
    drag,
    meterHandler,
    pinchStart,
    currentZoom,
    lastZoom,
    zoomHandler,
    zoomMin,
    zoomMax,
  ])
  // Project the full-sensor landscape crop onto the narrower portrait preview. The horizontal
  // output extends beyond this view, but these vertical bounds match what capture will save.
  const guideSource = settings.mode === 'single' ? recorder.stats.source0 : recorder.stats.source1
  const guideFrame = getLandscapeGuideFrame(width, height, settings.landscapePosition, guideSource)
  const guideStyle = useAnimatedStyle(() => ({
    opacity: guideOpacity?.value ?? 1,
    top: guidePosition
      ? Math.max(0, height - guideFrame.height) * guidePosition.value
      : guideFrame.top,
  }))
  return (
    <GestureDetector gesture={gestures}>
      <View
        collapsable={false}
        accessibilityHint={meteringEnabled ? t('camera.focusHint') : undefined}
        style={[styles.preview, { width, height }, embedded && styles.embedded]}>
        <DualRecorderPreview
          style={styles.fill}
          channel={settings.mode === 'single' ? 0 : kind === 'portrait' ? 1 : 2}
          portrait={kind === 'portrait'}
          cropPosition={
            kind === 'portrait' ? settings.portraitPosition : settings.landscapePosition
          }
          mirrored={settings.front}
        />
        {settings.grid && showGrid && (
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
        {(guide || guideOpacity) && (
          <Animated.View
            pointerEvents="none"
            style={[styles.guide, { height: guideFrame.height }, guideStyle]}>
            <View style={[styles.guideCorner, styles.guideCornerTopLeft]} />
            <View style={[styles.guideCorner, styles.guideCornerTopRight]} />
            <View style={[styles.guideCorner, styles.guideCornerBottomLeft]} />
            <View style={[styles.guideCorner, styles.guideCornerBottomRight]} />
          </Animated.View>
        )}
        {point && (
          <FocusReticle
            key={point.id}
            recorder={recorder}
            kind={kind}
            width={width}
            height={height}
            point={point}
            blockers={blockers}
            onDismiss={onDismissFocus}
          />
        )}
      </View>
    </GestureDetector>
  )
}
const createStyles = createThemedStyles((theme) => ({
  preview: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.background.surface,
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  embedded: { borderRadius: 0 },
  verticalGrid: {
    position: 'absolute',
    width: 1,
    top: 0,
    bottom: 0,
    opacity: 0.5,
    backgroundColor: theme.colors.border.strong,
  },
  horizontalGrid: {
    position: 'absolute',
    height: 1,
    left: 0,
    right: 0,
    opacity: 0.5,
    backgroundColor: theme.colors.border.strong,
  },
  guide: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: theme.colors.text.primary,
  },
  guideCorner: {
    position: 'absolute',
    width: theme.spacing.xl,
    height: theme.spacing.xl,
    borderColor: theme.colors.text.primary,
  },
  guideCornerTopLeft: {
    top: GUIDE_CORNER_OFFSET,
    left: GUIDE_CORNER_OFFSET,
    borderTopWidth: GUIDE_CORNER_STROKE_WIDTH,
    borderLeftWidth: GUIDE_CORNER_STROKE_WIDTH,
  },
  guideCornerTopRight: {
    top: GUIDE_CORNER_OFFSET,
    right: GUIDE_CORNER_OFFSET,
    borderTopWidth: GUIDE_CORNER_STROKE_WIDTH,
    borderRightWidth: GUIDE_CORNER_STROKE_WIDTH,
  },
  guideCornerBottomLeft: {
    bottom: GUIDE_CORNER_OFFSET,
    left: GUIDE_CORNER_OFFSET,
    borderBottomWidth: GUIDE_CORNER_STROKE_WIDTH,
    borderLeftWidth: GUIDE_CORNER_STROKE_WIDTH,
  },
  guideCornerBottomRight: {
    bottom: GUIDE_CORNER_OFFSET,
    right: GUIDE_CORNER_OFFSET,
    borderBottomWidth: GUIDE_CORNER_STROKE_WIDTH,
    borderRightWidth: GUIDE_CORNER_STROKE_WIDTH,
  },
}))
