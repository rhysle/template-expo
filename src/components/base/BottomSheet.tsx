import { useLayoutEffect, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const SPRING_CONFIG = { damping: 25, stiffness: 200, mass: 1 }
const DISMISS_DURATION_MS = 200

const animateDismiss = (
  translateY: SharedValue<number>,
  isDismissing: SharedValue<boolean>,
  screenHeight: number,
  setIsModalVisible: (visible: boolean) => void,
  onDismiss: () => void
) => {
  if (isDismissing.value) return

  isDismissing.value = true
  translateY.value = withTiming(screenHeight, { duration: DISMISS_DURATION_MS }, (finished) => {
    isDismissing.value = false
    if (finished) {
      scheduleOnRN(setIsModalVisible, false)
      scheduleOnRN(onDismiss)
    }
  })
}

export interface BottomSheetProps {
  visible: boolean
  /** Called once after the exit animation. User-initiated dismissals should set `visible` false here. */
  onDismiss: () => void
  children: React.ReactNode
}

export const BottomSheet = ({ visible, onDismiss, children }: BottomSheetProps) => {
  const styles = useThemedStyles(createStyles)
  const { spacing } = useTheme()
  const { height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [isModalVisible, setIsModalVisible] = useState(visible)
  const wasVisibleRef = useRef(false)

  const translateY = useSharedValue(screenHeight)
  const isDismissing = useSharedValue(false)

  const dismiss = () => {
    if (!visible && !isModalVisible) return
    animateDismiss(translateY, isDismissing, screenHeight, setIsModalVisible, onDismiss)
  }

  useLayoutEffect(() => {
    const wasVisible = wasVisibleRef.current
    wasVisibleRef.current = visible

    if (visible && !wasVisible) {
      isDismissing.value = false
      setIsModalVisible(true)
      translateY.value = screenHeight
      translateY.value = withSpring(0, SPRING_CONFIG)
    } else if (!visible && wasVisible && isModalVisible) {
      animateDismiss(translateY, isDismissing, screenHeight, setIsModalVisible, onDismiss)
    }
  }, [visible, isModalVisible, isDismissing, onDismiss, translateY, screenHeight])

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      if (event.translationY > 150 || event.velocityY > 500) {
        scheduleOnRN(dismiss)
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG)
      }
    })

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    }
  })

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, screenHeight], [1, 0], Extrapolation.CLAMP),
  }))

  return (
    <Modal
      visible={visible || isModalVisible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent>
      <GestureHandlerRootView style={styles.overlay}>
        <AnimatedPressable
          style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
          onPress={dismiss}
        />

        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[styles.sheet, animatedStyle, { paddingBottom: spacing.xl + insets.bottom }]}>
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
            <View onStartShouldSetResponder={() => true}>{children}</View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const createStyles = createThemedStyles((t) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: t.colors.background.surface,
    borderTopLeftRadius: t.borderRadius.xl,
    borderTopRightRadius: t.borderRadius.xl,
    maxHeight: '80%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.xl,
  },
  handle: {
    width: 44,
    height: 6,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.border.strong,
  },
  backdrop: {
    backgroundColor: t.colors.background.overlay,
  },
}))
