import type { AnimationObject, LottieViewProps } from 'lottie-react-native'
import LottieView from 'lottie-react-native'
import { useWindowDimensions, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import { Text } from '@/components/base'
import { createThemedStyles, useThemedStyles } from '@/theme'

const PREFERRED_ANIMATION_SIZE = 244
const MAX_ANIMATION_WIDTH_RATIO = 0.8

export type OnboardingLottieSource = AnimationObject | number

export interface OnboardingAnimationConfig {
  source: OnboardingLottieSource
  accessibilityLabel?: string
  loop?: boolean
  autoPlay?: boolean
  speed?: number
}

interface OnboardingScreenContentProps {
  animation: OnboardingAnimationConfig
  title: string
  description: string
}

export const OnboardingScreenContent = ({
  animation,
  title,
  description,
}: OnboardingScreenContentProps) => {
  const styles = useThemedStyles(createStyles)
  const reducedMotion = useReducedMotion()
  const { width: screenWidth } = useWindowDimensions()

  const shouldAutoPlay = !reducedMotion && (animation.autoPlay ?? true)
  const animationSize = Math.min(PREFERRED_ANIMATION_SIZE, screenWidth * MAX_ANIMATION_WIDTH_RATIO)

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.animationContainer,
          {
            width: animationSize,
            height: animationSize,
          },
        ]}
        accessibilityRole="image"
        accessibilityLabel={animation.accessibilityLabel ?? title}>
        <LottieView
          source={animation.source as LottieViewProps['source']}
          style={styles.animation}
          resizeMode="contain"
          autoPlay={shouldAutoPlay}
          loop={shouldAutoPlay ? (animation.loop ?? true) : false}
          speed={animation.speed ?? 1}
          progress={reducedMotion ? 0 : undefined}
        />
      </View>
      <Text variant="title" weight="bold" align="center">
        {title}
      </Text>
      <Text variant="subtitle" tone="secondary" align="center" style={styles.description}>
        {description}
      </Text>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing['3xl'],
    gap: t.spacing.xl,
  },
  animationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  description: {
    lineHeight: 24,
  },
}))
