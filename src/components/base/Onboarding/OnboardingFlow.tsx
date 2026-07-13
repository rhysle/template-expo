import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { createThemedStyles, useThemedStyles } from '@/theme'

import { OnboardingControls } from './OnboardingControls'
import { OnboardingPage } from './OnboardingPage'
import { PaginationDots } from './PaginationDots'
import type { OnboardingFlowProps } from './types'

const ANIMATION_DURATION = 400
const SWIPE_THRESHOLD_RATIO = 0.25
const SPRING_CONFIG = { damping: 20, mass: 0.9, stiffness: 200 }

export const OnboardingFlow = ({
  pages,
  swipeEnabled = true,
  animationType = 'slide',
  onComplete,
  onSkip,
  onPageChange,
}: OnboardingFlowProps) => {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()

  const currentIndex = useSharedValue(0)
  const scrollPosition = useSharedValue(0)
  const activeIndexRef = useSharedValue(0)
  // Gesture worklets can only capture serializable values. `pages` also contains React nodes,
  // so keep a separate array of keys for worklet callbacks.
  const pageCount = pages.length
  const pageKeys = pages.map((page) => page.key)

  const [activeIndex, setActiveIndex] = useState(0)

  const handlePageChanged = (index: number, pageKey: string) => {
    setActiveIndex(index)
    onPageChange?.(index, pageKey)
  }

  const isLastPage = activeIndex === pageCount - 1

  const paginationIndex = useDerivedValue(() =>
    animationType === 'slide' ? scrollPosition.value / screenWidth : currentIndex.value
  )

  const goToPage = (index: number) => {
    'worklet'
    activeIndexRef.value = index
    if (animationType === 'slide') {
      scrollPosition.value = withSpring(index * screenWidth, SPRING_CONFIG)
    } else {
      currentIndex.value = withTiming(index, { duration: ANIMATION_DURATION })
    }
    scheduleOnRN(handlePageChanged, index, pageKeys[index] ?? '')
  }

  const handleNext = () => {
    if (isLastPage) {
      onComplete()
    } else {
      goToPage(activeIndex + 1)
    }
  }

  const handleSkip = () => {
    ;(onSkip ?? onComplete)()
  }

  const panGesture = Gesture.Pan()
    .enabled(swipeEnabled)
    .activeOffsetX([-10, 10])
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      if (animationType !== 'slide') return
      const basePosition = activeIndexRef.value * screenWidth
      const rawPosition = basePosition - event.translationX
      scrollPosition.value = Math.min(Math.max(rawPosition, 0), (pageCount - 1) * screenWidth)
    })
    .onEnd((event) => {
      const swipeThreshold = screenWidth * SWIPE_THRESHOLD_RATIO
      const shouldGoNext =
        (event.translationX < -swipeThreshold || event.velocityX < -500) &&
        activeIndexRef.value < pageCount - 1
      const shouldGoPrev =
        (event.translationX > swipeThreshold || event.velocityX > 500) && activeIndexRef.value > 0

      if (shouldGoNext) {
        goToPage(activeIndexRef.value + 1)
      } else if (shouldGoPrev) {
        goToPage(activeIndexRef.value - 1)
      } else if (animationType === 'slide') {
        scrollPosition.value = withSpring(activeIndexRef.value * screenWidth, SPRING_CONFIG)
      }
    })

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={styles.pagesContainer}>
          {pages.map((page, index) => (
            <OnboardingPage
              key={page.key}
              pageIndex={index}
              screenWidth={screenWidth}
              animationType={animationType}
              currentIndex={currentIndex}
              scrollPosition={scrollPosition}>
              {page.content}
            </OnboardingPage>
          ))}
        </Animated.View>
      </GestureDetector>
      <View style={styles.footer}>
        <PaginationDots count={pages.length} currentIndex={paginationIndex} />
        <OnboardingControls isLastPage={isLastPage} onNext={handleNext} onSkip={handleSkip} />
      </View>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.background.base,
  },
  pagesContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  footer: {
    gap: t.spacing.xl,
    paddingBottom: t.spacing.lg,
  },
}))
