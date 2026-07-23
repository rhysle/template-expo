import { useEffect, useMemo } from 'react'
import {
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useIsRTL } from '@/services/rtl'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

const DEFAULT_MIN = 0
const DEFAULT_MAX = 1
const SLIDER_HEIGHT = 44
const DEFAULT_THUMB_SIZE = 22
const DEFAULT_TRACK_HEIGHT = 6
const MIN_THUMB_SIZE = 18
const MIN_TRACK_HEIGHT = 2
const VALUE_ANIMATION_DURATION_MS = 160
const THUMB_ACTIVE_SCALE = 1.14
const THUMB_SPRING_CONFIG = { damping: 16, mass: 0.6, stiffness: 260 }

export interface SliderProps {
  value: number
  onValueChange: (value: number) => void
  onValueChangeFinished?: () => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  activeColor?: string
  inactiveColor?: string
  thumbColor?: string
  thumbSize?: number
  trackHeight?: number
  accessibilityLabel?: string
  accessibilityValueText?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

const clamp = (value: number, min: number, max: number) => {
  'worklet'
  return Math.min(Math.max(value, min), max)
}

const getSafeRange = (min: number | undefined, max: number | undefined) => {
  const safeMin = Number.isFinite(min) ? (min as number) : DEFAULT_MIN
  const requestedMax = Number.isFinite(max) ? (max as number) : DEFAULT_MAX
  const safeMax = requestedMax > safeMin ? requestedMax : safeMin + 1

  return { min: safeMin, max: safeMax, range: safeMax - safeMin }
}

export const Slider = ({
  value,
  onValueChange,
  onValueChangeFinished,
  min,
  max,
  step,
  disabled = false,
  activeColor,
  inactiveColor,
  thumbColor,
  thumbSize = DEFAULT_THUMB_SIZE,
  trackHeight = DEFAULT_TRACK_HEIGHT,
  accessibilityLabel,
  accessibilityValueText,
  style,
  testID,
}: SliderProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const isRTL = useIsRTL()
  const { min: safeMin, max: safeMax, range } = getSafeRange(min, max)
  const safeStep = Number.isFinite(step) && (step as number) > 0 ? (step as number) : undefined
  const safeThumbSize = Number.isFinite(thumbSize)
    ? clamp(thumbSize, MIN_THUMB_SIZE, SLIDER_HEIGHT)
    : DEFAULT_THUMB_SIZE
  const safeTrackHeight = Number.isFinite(trackHeight)
    ? Math.max(trackHeight, MIN_TRACK_HEIGHT)
    : DEFAULT_TRACK_HEIGHT
  const normalizedValue = clamp(Number.isFinite(value) ? value : safeMin, safeMin, safeMax)
  const normalizedProgress = (normalizedValue - safeMin) / range
  const progress = useSharedValue(normalizedProgress)
  const externalProgress = useSharedValue(normalizedProgress)
  const sliderWidth = useSharedValue(0)
  const isPressed = useSharedValue(false)
  const thumbScale = useSharedValue(1)
  const onValueChangeHandler = useSharedValue({ callback: onValueChange })
  const onValueChangeFinishedHandler = useSharedValue({ callback: onValueChangeFinished })
  const resolvedActiveColor = activeColor ?? colors.primary.main
  const resolvedInactiveColor = inactiveColor ?? colors.background.subtle
  const resolvedThumbColor = thumbColor ?? resolvedActiveColor

  useEffect(() => {
    externalProgress.value = normalizedProgress
  }, [externalProgress, normalizedProgress])

  useEffect(() => {
    onValueChangeHandler.value = { callback: onValueChange }
    onValueChangeFinishedHandler.value = { callback: onValueChangeFinished }
  }, [onValueChange, onValueChangeFinished, onValueChangeFinishedHandler, onValueChangeHandler])

  useAnimatedReaction(
    () => externalProgress.value,
    (nextProgress) => {
      if (!isPressed.value) {
        progress.value = withTiming(nextProgress, {
          duration: VALUE_ANIMATION_DURATION_MS,
          reduceMotion: ReduceMotion.System,
        })
      }
    }
  )

  // This must remain stable during value updates. Reattaching a GestureDetector while a native
  // gesture event is in flight can leave Fabric with a detached event target.
  const gesture = useMemo(() => {
    const updateValueFromPosition = (positionX: number) => {
      'worklet'

      const travel = Math.max(sliderWidth.value - safeThumbSize, 0)
      if (travel === 0) return

      const physicalProgress = clamp((positionX - safeThumbSize / 2) / travel, 0, 1)
      const logicalProgress = isRTL ? 1 - physicalProgress : physicalProgress
      const rawValue = safeMin + logicalProgress * range
      const steppedValue = safeStep
        ? safeMin + Math.round((rawValue - safeMin) / safeStep) * safeStep
        : rawValue
      const nextValue = clamp(steppedValue, safeMin, safeMax)

      progress.value = (nextValue - safeMin) / range
      scheduleOnRN(onValueChangeHandler.value.callback, nextValue)
    }

    const finishValueChange = () => {
      'worklet'
      if (onValueChangeFinishedHandler.value.callback) {
        scheduleOnRN(onValueChangeFinishedHandler.value.callback)
      }
    }

    const panGesture = Gesture.Pan()
      .enabled(!disabled)
      .onBegin(() => {
        isPressed.value = true
        thumbScale.value = withSpring(THUMB_ACTIVE_SCALE, THUMB_SPRING_CONFIG)
      })
      .onStart(({ x }) => {
        updateValueFromPosition(x)
      })
      .onUpdate(({ x }) => {
        updateValueFromPosition(x)
      })
      .onEnd(() => {
        finishValueChange()
      })
      .onFinalize(() => {
        isPressed.value = false
        thumbScale.value = withSpring(1, THUMB_SPRING_CONFIG)
      })

    const tapGesture = Gesture.Tap()
      .enabled(!disabled)
      .onEnd(({ x }, success) => {
        if (!success) return
        updateValueFromPosition(x)
        finishValueChange()
      })

    return Gesture.Exclusive(panGesture, tapGesture)
  }, [
    disabled,
    isPressed,
    isRTL,
    onValueChangeFinishedHandler,
    onValueChangeHandler,
    progress,
    range,
    safeMax,
    safeMin,
    safeStep,
    safeThumbSize,
    sliderWidth,
    thumbScale,
  ])

  const activeTrackAnimatedStyle = useAnimatedStyle(() => {
    const travel = Math.max(sliderWidth.value - safeThumbSize, 0)
    const scaleInset = ((thumbScale.value - 1) * safeThumbSize) / 2
    const scaledTravel = Math.max(travel - scaleInset * 2, 0)
    return { width: safeThumbSize / 2 + scaleInset + progress.value * scaledTravel }
  })

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    const travel = Math.max(sliderWidth.value - safeThumbSize, 0)
    const scaleInset = ((thumbScale.value - 1) * safeThumbSize) / 2
    const scaledTravel = Math.max(travel - scaleInset * 2, 0)
    const directionalProgress = isRTL ? 1 - progress.value : progress.value
    return {
      transform: [
        { translateX: scaleInset + directionalProgress * scaledTravel },
        { scale: thumbScale.value },
      ],
    }
  })

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    sliderWidth.value = nativeEvent.layout.width
  }

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (
      disabled ||
      (nativeEvent.actionName !== 'increment' && nativeEvent.actionName !== 'decrement')
    ) {
      return
    }

    const adjustment = safeStep ?? range / 10
    const direction = nativeEvent.actionName === 'increment' ? 1 : -1
    const nextValue = clamp(normalizedValue + adjustment * direction, safeMin, safeMax)

    onValueChange(nextValue)
    onValueChangeFinished?.()
  }

  return (
    <View
      accessible
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      accessibilityState={{ disabled }}
      accessibilityValue={{
        min: safeMin,
        max: safeMax,
        now: normalizedValue,
        text: accessibilityValueText,
      }}
      onAccessibilityAction={handleAccessibilityAction}
      onLayout={handleLayout}
      testID={testID}
      style={[styles.container, disabled && styles.disabled, style]}>
      <GestureDetector gesture={gesture}>
        <Animated.View collapsable={false} style={styles.gestureSurface}>
          <View
            pointerEvents="none"
            style={[
              styles.track,
              {
                left: 0,
                right: 0,
                top: (SLIDER_HEIGHT - safeTrackHeight) / 2,
                height: safeTrackHeight,
                borderRadius: safeTrackHeight / 2,
                backgroundColor: resolvedInactiveColor,
              },
            ]}>
            <Animated.View
              style={[
                styles.activeTrack,
                isRTL ? { right: 0 } : { left: 0 },
                {
                  height: safeTrackHeight,
                  borderRadius: safeTrackHeight / 2,
                  backgroundColor: resolvedActiveColor,
                },
                activeTrackAnimatedStyle,
              ]}
            />
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                width: safeThumbSize,
                height: safeThumbSize,
                borderRadius: safeThumbSize / 2,
                top: (SLIDER_HEIGHT - safeThumbSize) / 2,
                backgroundColor: resolvedThumbColor,
              },
              thumbAnimatedStyle,
            ]}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    width: '100%',
    height: SLIDER_HEIGHT,
    justifyContent: 'center',
  },
  gestureSurface: {
    flex: 1,
  },
  track: {
    position: 'absolute',
    overflow: 'hidden',
  },
  activeTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    ...t.shadows.xs,
  },
  disabled: {
    opacity: 0.5,
  },
}))
