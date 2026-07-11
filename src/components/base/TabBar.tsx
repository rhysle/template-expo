import { BlurView } from 'expo-blur'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { useEffect, useRef } from 'react'
import { Platform, useWindowDimensions, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { Pressable } from './Pressable'

export type TabBarAnimationType = 'indicator' | 'none'

export interface TabBarProps extends BottomTabBarProps {
  showLabel?: boolean
  animationType?: TabBarAnimationType
  blur?: boolean
  blurIntensity?: number
}

const INDICATOR_WIDTH = 40

const getIndicatorPosition = (index: number, tabWidth: number, paddingOffset: number) =>
  paddingOffset + index * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2
const LABEL_MARGIN_TOP = 2

interface TabBarIndicatorProps {
  index: number
  tabWidth: number
  paddingOffset: number
}

const TabBarIndicator = ({ index, tabWidth, paddingOffset }: TabBarIndicatorProps) => {
  const styles = useThemedStyles(createStyles)
  const indicatorPosition = useSharedValue(getIndicatorPosition(index, tabWidth, paddingOffset))
  const hasInitialized = useRef(false)

  useEffect(() => {
    const targetPosition = getIndicatorPosition(index, tabWidth, paddingOffset)

    if (!hasInitialized.current) {
      hasInitialized.current = true
    } else {
      indicatorPosition.value = withSpring(targetPosition, {
        damping: 22,
        stiffness: 210,
        mass: 0.8,
      })
    }
  }, [indicatorPosition, index, tabWidth, paddingOffset])

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }))

  return <Animated.View style={[styles.indicator, indicatorAnimatedStyle]} />
}

interface TabBarItemProps {
  index: number
  activeIndex: SharedValue<number>
  isFocused: boolean
  route: BottomTabBarProps['state']['routes'][number]
  options: BottomTabBarProps['descriptors'][string]['options']
  onPress: () => void
  showLabel?: boolean
}

const TabBarItem = ({
  index,
  activeIndex,
  isFocused,
  route,
  options,
  onPress,
  showLabel,
}: TabBarItemProps) => {
  const { colors, typography } = useTheme()
  const styles = useThemedStyles(createStyles)

  // Runs entirely on the UI thread - no useEffect, no JS-thread scheduling delay
  const progress = useDerivedValue(() =>
    withTiming(activeIndex.value === index ? 1 : 0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    })
  )

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.1]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -2]) },
    ],
  }))

  const focusedIconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }))

  const unfocusedIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }))

  const labelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.7, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.96, 1]) }],
  }))

  const label = options.title ?? route.name
  const labelColor = isFocused ? colors.primary.main : colors.text.muted

  const renderIcon = (focused: boolean) =>
    options.tabBarIcon?.({
      color: focused ? colors.primary.main : colors.text.muted,
      size: iconSizes.lg,
      focused,
    })

  return (
    <Pressable
      onPress={onPress}
      variant="ghost"
      style={styles.tabButton}
      activeOpacity={0.7}
      haptic={!isFocused}>
      <Animated.View style={iconAnimatedStyle}>
        <View style={styles.iconContainer}>
          <Animated.View style={[styles.iconAbsolute, unfocusedIconStyle]}>
            {renderIcon(false)}
          </Animated.View>
          <Animated.View style={[styles.iconAbsolute, focusedIconStyle]}>
            {renderIcon(true)}
          </Animated.View>
        </View>
      </Animated.View>
      {showLabel && (
        <Animated.View style={labelAnimatedStyle}>
          <Animated.Text
            style={[
              styles.labelText,
              {
                color: labelColor,
                fontFamily: isFocused
                  ? typography.fontFamily.semibold
                  : typography.fontFamily.regular,
                fontWeight: isFocused ? typography.weights.semibold : typography.weights.regular,
              },
            ]}>
            {label}
          </Animated.Text>
        </Animated.View>
      )}
    </Pressable>
  )
}

export const TabBar = ({
  state,
  descriptors,
  navigation,
  showLabel,
  animationType,
  blur = false,
  blurIntensity = 60,
}: TabBarProps) => {
  const styles = useThemedStyles(createStyles)
  const { spacing } = useTheme()
  const { width } = useWindowDimensions()
  const paddingOffset = spacing.lg
  const tabWidth = (width - paddingOffset * 2) / state.routes.length

  // Single shared value propagated to all items - one UI-thread update drives every tab animation
  const activeIndex = useSharedValue(state.index)
  useEffect(() => {
    activeIndex.value = state.index
  }, [activeIndex, state.index])

  const tabBarContent = (
    <>
      {animationType === 'indicator' && (
        <TabBarIndicator index={state.index} tabWidth={tabWidth} paddingOffset={paddingOffset} />
      )}

      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index
          const options = descriptors[route.key].options

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          return (
            <TabBarItem
              key={route.key}
              index={index}
              activeIndex={activeIndex}
              isFocused={isFocused}
              route={route}
              options={options}
              onPress={onPress}
              showLabel={showLabel}
            />
          )
        })}
      </View>
    </>
  )

  if (Platform.OS === 'ios' && blur) {
    return (
      <BlurView intensity={blurIntensity} tint="dark" style={styles.tabContainerBlur}>
        {tabBarContent}
      </BlurView>
    )
  }

  return <View style={styles.tabContainer}>{tabBarContent}</View>
}

const createStyles = createThemedStyles((t) => ({
  tabContainer: {
    backgroundColor: t.colors.background.card,
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  tabContainerBlur: {
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.lg,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.spacing.xl,
  },
  iconContainer: {
    width: iconSizes.lg,
    height: iconSizes.lg,
  },
  iconAbsolute: {
    position: 'absolute',
  },
  labelText: {
    fontSize: t.typography.sizes.xs,
    marginTop: LABEL_MARGIN_TOP,
  },
  indicator: {
    position: 'absolute',
    top: t.spacing.xs,
    width: INDICATOR_WIDTH,
    height: t.spacing.xs,
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.main,
    opacity: 0.9,
  },
  tabRow: {
    flexDirection: 'row',
  },
}))
