import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const SPRING_CONFIG = { damping: 25, stiffness: 200, mass: 1 }

export interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
}

export const BottomSheet = ({ visible, onClose, children }: BottomSheetProps) => {
  const styles = useThemedStyles(createStyles)
  const { spacing } = useTheme()
  const { height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [isModalVisible, setIsModalVisible] = useState(visible)

  const translateY = useSharedValue(screenHeight)

  useEffect(() => {
    if (visible) {
      setIsModalVisible(true)
      translateY.value = withSpring(0, SPRING_CONFIG)
    } else {
      translateY.value = withTiming(screenHeight, { duration: 200 }, (finished) => {
        if (finished) {
          scheduleOnRN(setIsModalVisible, false)
        }
      })
    }
  }, [visible, translateY, screenHeight])

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      if (event.translationY > 150 || event.velocityY > 500) {
        scheduleOnRN(onClose)
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

  if (!isModalVisible) return null

  return (
    <Modal visible={isModalVisible} transparent animationType="none" statusBarTranslucent>
      <GestureHandlerRootView style={styles.overlay}>
        <AnimatedPressable
          style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
          onPress={onClose}
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
    backgroundColor: withAlpha(t.colors.background.card, 0.5),
  },
  backdrop: {
    backgroundColor: t.colors.background.overlay,
  },
}))
