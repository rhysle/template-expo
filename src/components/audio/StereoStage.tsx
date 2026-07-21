import { Image } from 'expo-image'
import { SpeakerHighIcon } from 'phosphor-react-native'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { type LayoutChangeEvent, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { Text } from '@/components/base'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

interface StereoStageProps {
  pan: number
  active: boolean
  leftLabel: string
  rightLabel: string
  positionLabel: string
}

export const StereoStage = ({
  pan,
  active,
  leftLabel,
  rightLabel,
  positionLabel,
}: StereoStageProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const animatedPan = useSharedValue(pan)
  const trackWidth = useSharedValue(0)

  useEffect(() => {
    animatedPan.value = withSpring(pan, { damping: 20, stiffness: 170, mass: 0.8 })
  }, [animatedPan, pan])

  const leftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedPan.value, [-1, 0, 1], [1, 0.72, 0.42]),
    transform: [{ scale: interpolate(animatedPan.value, [-1, 0, 1], [1.08, 1, 0.94]) }],
  }))
  const rightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedPan.value, [-1, 0, 1], [0.42, 0.72, 1]),
    transform: [{ scale: interpolate(animatedPan.value, [-1, 0, 1], [0.94, 1, 1.08]) }],
  }))
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ((animatedPan.value + 1) / 2) * trackWidth.value - 9 }],
  }))

  const handleTrackLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    trackWidth.value = nativeEvent.layout.width
  }

  return (
    <View
      accessible
      accessibilityLabel={positionLabel}
      style={[styles.container, active && styles.containerActive]}>
      <View style={styles.stageRow}>
        <Animated.View style={[styles.speaker, leftStyle]}>
          <SpeakerHighIcon size={iconSizes.xl} color={theme.colors.primary.main} weight="fill" />
          <Text variant="caption" weight="bold" tone="accent">
            {leftLabel}
          </Text>
        </Animated.View>

        <Image
          accessibilityLabel={t('audioTools.common.mascot')}
          source={require('@/assets/images/mascot.png')}
          contentFit="cover"
          style={styles.mascot}
        />

        <Animated.View style={[styles.speaker, rightStyle]}>
          <SpeakerHighIcon size={iconSizes.xl} color={theme.colors.primary.main} weight="fill" />
          <Text variant="caption" weight="bold" tone="accent">
            {rightLabel}
          </Text>
        </Animated.View>
      </View>

      <View onLayout={handleTrackLayout} style={styles.panTrack}>
        <View style={styles.panTrackFill} />
        <Animated.View style={[styles.panIndicator, indicatorStyle]} />
      </View>
      <Text variant="caption" weight="semibold" align="center" tone="secondary">
        {positionLabel}
      </Text>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    width: '100%',
    gap: t.spacing.lg,
    padding: t.spacing.lg,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius['2xl'],
    borderWidth: 1,
    borderColor: t.colors.border.subtle,
    backgroundColor: t.colors.background.card,
    ...t.shadows.sm,
  },
  containerActive: {
    borderColor: withAlpha(t.colors.primary.main, 0.55),
  },
  stageRow: {
    minHeight: 164,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.sm,
  },
  speaker: {
    width: 68,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    borderRadius: t.borderRadius.xl,
    backgroundColor: t.colors.primary.soft,
  },
  mascot: {
    flexShrink: 1,
    width: 144,
    height: 144,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius['3xl'],
  },
  panTrack: {
    height: 18,
    justifyContent: 'center',
  },
  panTrackFill: {
    height: 6,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.border.default,
  },
  panIndicator: {
    position: 'absolute',
    left: 0,
    width: 18,
    height: 18,
    borderRadius: t.borderRadius.full,
    borderWidth: 3,
    borderColor: t.colors.background.surface,
    backgroundColor: t.colors.primary.main,
    ...t.shadows.sm,
  },
}))
