import { Text } from '@shared/core/components/base'
import { SpinArcLoader } from '@shared/core/components/base/Loader'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { RecorderController } from '@/services/camera/useRecorder'
import { cameraColors, createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { CameraPreview, type FocusPoint } from './CameraPreview'
import { CameraTransition } from './CameraTransition'

export type PreviewLayout = 'pip' | 'stacked' | 'guide'
export function CameraStage({
  recorder,
  layout,
  switching,
  switchProgress,
  children,
}: {
  recorder: RecorderController
  layout: PreviewLayout
  switching: boolean
  switchProgress: SharedValue<number>
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null)
  const insetX = useSharedValue(0)
  const insetY = useSharedValue(0)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const insetScale = useSharedValue(1)
  const startScale = useSharedValue(1)
  const restoreFraction = useSharedValue(0.55)
  const expanded = useSharedValue(false)
  useEffect(() => {
    if (!recorder.ready) setFocusPoint(null)
  }, [recorder.ready])
  const width = Math.min(stage.width, (stage.height * 9) / 16)
  const height = (width * 16) / 9
  const insetWidth = Math.min(theme.spacing['9xl'], width * 0.55)
  const insetHeight = (insetWidth * 9) / 16
  const minScale = insetWidth > 0 ? (width * 0.4) / insetWidth : 1
  const maxScale = insetWidth > 0 ? (width * 0.75) / insetWidth : 1
  const padding = theme.spacing.sm * 2
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(12)
        .maxPointers(1)
        .onStart(() => {
          cancelAnimation(insetScale)
          const scale = Math.max(minScale, Math.min(maxScale, insetScale.value))
          const maxX = Math.max(0, width - insetWidth * scale - padding)
          const maxY = Math.max(0, height - insetHeight * scale - padding)
          startX.value = Math.max(-maxX, Math.min(0, insetX.value))
          startY.value = Math.max(-maxY, Math.min(0, insetY.value))
        })
        .onUpdate((event) => {
          const scale = Math.max(minScale, Math.min(maxScale, insetScale.value))
          const maxX = Math.max(0, width - insetWidth * scale - padding)
          const maxY = Math.max(0, height - insetHeight * scale - padding)
          insetX.value = Math.max(-maxX, Math.min(0, startX.value + event.translationX))
          insetY.value = Math.max(-maxY, Math.min(0, startY.value + event.translationY))
        }),
    [
      startX,
      startY,
      insetX,
      insetY,
      insetScale,
      minScale,
      maxScale,
      width,
      height,
      insetWidth,
      insetHeight,
      padding,
    ]
  )
  const resize = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          cancelAnimation(insetScale)
          expanded.value = false
          startScale.value = Math.max(minScale, Math.min(maxScale, insetScale.value))
        })
        .onUpdate((event) => {
          const scale = Math.max(minScale, Math.min(maxScale, startScale.value * event.scale))
          insetScale.value = scale
          insetX.value = Math.max(
            -Math.max(0, width - insetWidth * scale - padding),
            Math.min(0, insetX.value)
          )
          insetY.value = Math.max(
            -Math.max(0, height - insetHeight * scale - padding),
            Math.min(0, insetY.value)
          )
        }),
    [
      startScale,
      expanded,
      insetScale,
      minScale,
      maxScale,
      insetX,
      insetY,
      width,
      height,
      insetWidth,
      insetHeight,
      padding,
    ]
  )
  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(250)
        .maxDelay(280)
        .maxDistance(10)
        .onEnd((_event, success) => {
          if (!success || width <= 0 || insetWidth <= 0) return
          const current = Math.max(minScale, Math.min(maxScale, insetScale.value))
          const restore = expanded.value || current >= maxScale - 0.001
          if (!restore) restoreFraction.value = (current * insetWidth) / width
          expanded.value = !restore
          const target = restore
            ? Math.max(minScale, Math.min(maxScale, (restoreFraction.value * width) / insetWidth))
            : maxScale
          insetScale.value = withTiming(target, { duration: 180 })
        }),
    [width, insetWidth, minScale, maxScale, insetScale, restoreFraction, expanded]
  )
  const insetStyle = useAnimatedStyle(() => {
    const scale = Math.max(minScale, Math.min(maxScale, insetScale.value))
    const maxX = Math.max(0, width - insetWidth * scale - padding)
    const maxY = Math.max(0, height - insetHeight * scale - padding)
    return {
      width: insetWidth * scale,
      height: insetHeight * scale,
      transform: [
        { translateX: Math.max(-maxX, Math.min(0, insetX.value)) },
        { translateY: Math.max(-maxY, Math.min(0, insetY.value)) },
      ],
    }
  })
  const feedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + switchProgress.value * 0.025 }],
  }))
  const stackedWidth = Math.max(
    0,
    Math.min(stage.width, (stage.height - theme.spacing.md) / (9 / 16 + (0.58 * 16) / 9))
  )
  const dismissFocus = (id: number) =>
    setFocusPoint((current) => (current?.id === id ? null : current))
  const previewProps = {
    recorder,
    focusPoint,
    onFocusPoint: setFocusPoint,
    onDismissFocus: dismissFocus,
  }
  return (
    <View style={styles.stage} onLayout={(event) => setStage(event.nativeEvent.layout)}>
      <Animated.View style={[styles.feed, feedStyle]}>
        {(recorder.ready || switching) && stage.width > 0 && stage.height > 0 ? (
          layout === 'stacked' ? (
            <View style={styles.stacked}>
              <CameraPreview
                {...previewProps}
                kind="landscape"
                width={stackedWidth}
                height={(stackedWidth * 9) / 16}
              />
              <CameraPreview
                {...previewProps}
                kind="portrait"
                width={stackedWidth * 0.58}
                height={(stackedWidth * 0.58 * 16) / 9}
              />
            </View>
          ) : (
            <View style={{ width, height }}>
              <CameraPreview
                {...previewProps}
                kind="portrait"
                width={width}
                height={height}
                guide={layout === 'guide'}
              />
              {layout === 'pip' && (
                <Animated.View style={[styles.inset, insetStyle]}>
                  <CameraPreview
                    {...previewProps}
                    kind="landscape"
                    width={insetWidth}
                    height={insetHeight}
                    pip
                    pinchGesture={resize}
                    doubleTapGesture={doubleTap}
                    meteringEnabled={false}
                    drag={pan}
                  />
                </Animated.View>
              )}
            </View>
          )
        ) : (
          <View style={styles.waiting}>
            <SpinArcLoader color={theme.colors.primary.main} />
            <Text tone="secondary">
              {recorder.device ? t('camera.waiting') : t('camera.noCamera')}
            </Text>
          </View>
        )}
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
  stacked: { alignItems: 'center', gap: theme.spacing.md },
  inset: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
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
