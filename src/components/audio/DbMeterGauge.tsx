import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import { Text } from '@/components/base'
import { MAX_ESTIMATED_DB } from '@/services/audio'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

interface DbMeterGaugeProps {
  value: number
  indicatorColor: string
  accessibilityLabel: string
  style?: StyleProp<ViewStyle>
}

export const DbMeterGauge = ({
  value,
  indicatorColor,
  accessibilityLabel,
  style,
}: DbMeterGaugeProps) => {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const trackWidth = useSharedValue(0)
  const position = useSharedValue(0)

  useEffect(() => {
    position.value = withSpring(Math.min(Math.max(value / MAX_ESTIMATED_DB, 0), 1), {
      damping: 22,
      stiffness: 180,
      mass: 0.7,
    })
  }, [position, value])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * trackWidth.value - 10 }],
  }))

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    trackWidth.value = nativeEvent.layout.width
  }

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: MAX_ESTIMATED_DB, now: Math.round(value) }}
      style={[styles.container, style]}>
      <View onLayout={handleLayout} style={styles.trackContainer}>
        <LinearGradient
          colors={[
            theme.colors.status.success,
            '#84CC16',
            theme.colors.status.warning,
            '#F97316',
            theme.colors.status.error,
          ]}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.track}
        />
        <Animated.View
          style={[styles.indicator, { backgroundColor: indicatorColor }, indicatorStyle]}
        />
      </View>
      <View style={styles.labels}>
        {[0, 30, 60, 90, 120].map((tick) => (
          <Text key={tick} variant="caption" tone="muted" style={styles.tickLabel}>
            {tick}
          </Text>
        ))}
      </View>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    width: '100%',
    gap: t.spacing.sm,
  },
  trackContainer: {
    height: 20,
    justifyContent: 'center',
  },
  track: {
    height: 10,
    borderRadius: t.borderRadius.full,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    width: 24,
    height: 24,
    borderRadius: t.borderRadius.full,
    borderWidth: 3,
    borderColor: t.colors.background.surface,
    ...t.shadows.sm,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tickLabel: {
    width: 28,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
}))
