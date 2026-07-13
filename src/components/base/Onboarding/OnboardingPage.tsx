import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated'

import type { OnboardingAnimationType } from './types'

interface OnboardingPageProps {
  children: ReactNode
  pageIndex: number
  screenWidth: number
  animationType: OnboardingAnimationType
  currentIndex: SharedValue<number>
  scrollPosition: SharedValue<number>
}

export const OnboardingPage = ({
  children,
  pageIndex,
  screenWidth,
  animationType,
  currentIndex,
  scrollPosition,
}: OnboardingPageProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    if (animationType === 'slide') {
      return {
        transform: [{ translateX: pageIndex * screenWidth - scrollPosition.value }],
      }
    }

    return {
      opacity: interpolate(
        currentIndex.value,
        [pageIndex - 1, pageIndex, pageIndex + 1],
        [0, 1, 0],
        'clamp'
      ),
    }
  })

  return (
    <Animated.View style={[styles.page, animatedStyle]} pointerEvents="auto">
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  page: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
