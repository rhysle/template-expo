import { withAlpha } from '@shared/core/utils/color'
import { BlurView } from 'expo-blur'
import { Platform, View } from 'react-native'
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

export function CameraTransition({ progress }: { progress: SharedValue<number> }) {
  const { appearance } = useTheme()
  const styles = useThemedStyles(createStyles)
  const animatedProps = useAnimatedProps(() => ({ intensity: progress.value * 70 }))
  const coverStyle = useAnimatedStyle(() => ({ opacity: progress.value }))
  return (
    <Animated.View
      style={[styles.cover, coverStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Platform.OS === 'ios' && (
        <AnimatedBlurView tint={appearance} animatedProps={animatedProps} style={styles.fill} />
      )}
      <View style={[styles.fill, styles.dim]} />
    </Animated.View>
  )
}

const createStyles = createThemedStyles((theme) => ({
  cover: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1 },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  dim: {
    backgroundColor: withAlpha(theme.colors.background.base, Platform.OS === 'ios' ? 0.35 : 0.92),
  },
}))
