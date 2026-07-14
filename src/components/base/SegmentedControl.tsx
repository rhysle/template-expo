import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import { useIsRTL } from '@/services/rtl'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { Button } from './Button'
import { Text } from './Text'

type SegmentedControlSize = 'sm' | 'md' | 'lg'
type SegmentLayout = { x: number; width: number }

const INDICATOR_SPRING_CONFIG = {
  damping: 22,
  stiffness: 210,
  mass: 0.8,
} as const

export interface SegmentedOption<T extends string = string> {
  label: string
  value: T
  disabled?: boolean
  testID?: string
  icon?: (color: string) => ReactNode
  iconPosition?: 'left' | 'right'
  locked?: boolean
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onValueChange: (nextValue: T) => void
  size?: SegmentedControlSize
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  segmentStyle?: StyleProp<ViewStyle>
  fullWidth?: boolean
}

export const SegmentedControl = <T extends string = string>({
  options,
  value,
  onValueChange,
  size = 'sm',
  disabled = false,
  style,
  segmentStyle,
  fullWidth = true,
}: SegmentedControlProps<T>) => {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const isRTL = useIsRTL()
  const [segmentLayouts, setSegmentLayouts] = useState<Record<string, SegmentLayout>>({})
  const [containerWidth, setContainerWidth] = useState(0)
  const [hasIndicatorLayout, setHasIndicatorLayout] = useState(false)
  const indicatorX = useSharedValue(0)
  const indicatorWidth = useSharedValue(0)
  const hasInitialized = useRef(false)

  useEffect(() => {
    const targetLayout = segmentLayouts[value]

    if (!targetLayout) {
      setHasIndicatorLayout(false)
      return
    }

    setHasIndicatorLayout(true)

    // In RTL, the absolute indicator defaults to the START edge (physical right), so
    // translateX: 0 means "at the right edge". Negative values move it toward physical left.
    // layout.x is always measured from physical left, so for a segment at physical position x
    // the required offset from the right edge is: x + width - containerWidth (always <= 0).
    const physicalX = isRTL ? targetLayout.x + targetLayout.width - containerWidth : targetLayout.x

    if (!hasInitialized.current) {
      indicatorX.value = physicalX
      indicatorWidth.value = targetLayout.width
      hasInitialized.current = true
      return
    }

    indicatorX.value = withSpring(physicalX, INDICATOR_SPRING_CONFIG)
    indicatorWidth.value = withSpring(targetLayout.width, INDICATOR_SPRING_CONFIG)
  }, [containerWidth, indicatorWidth, indicatorX, isRTL, segmentLayouts, value])

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }))

  if (!options.length) {
    return <View accessibilityRole="tablist" style={[styles.container, style]} />
  }

  const handleContainerLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setContainerWidth(nativeEvent.layout.width)
  }

  const handleSegmentLayout =
    (optionValue: T) =>
    ({ nativeEvent }: LayoutChangeEvent) => {
      const { x, width } = nativeEvent.layout

      setSegmentLayouts((previousLayouts) => {
        const previousLayout = previousLayouts[optionValue]
        if (previousLayout?.x === x && previousLayout.width === width) {
          return previousLayouts
        }

        return {
          ...previousLayouts,
          [optionValue]: { x, width },
        }
      })
    }

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.container, style]}
      onLayout={handleContainerLayout}>
      {hasIndicatorLayout ? (
        <Animated.View pointerEvents="none" style={[styles.indicator, indicatorAnimatedStyle]} />
      ) : null}

      {options.map((option) => {
        const isSelected = option.value === value
        const isDisabled = disabled || option.disabled
        const enableHaptic = !isSelected && !isDisabled
        const isLocked = option.locked === true && !isSelected
        const iconColor = isSelected ? theme.colors.text.inverse : theme.colors.primary.main

        return (
          <View
            key={option.value}
            onLayout={handleSegmentLayout(option.value)}
            style={[
              styles.segmentWrapper,
              fullWidth && styles.segmentEqualWidth,
              isLocked && styles.segmentLocked,
            ]}>
            <Button
              variant="ghost"
              size={size}
              haptic={enableHaptic}
              hapticType="selection"
              disabled={isDisabled}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected, disabled: isDisabled }}
              testID={option.testID}
              style={[styles.segmentButton, segmentStyle]}
              leftIcon={
                option.icon && option.iconPosition === 'left' ? option.icon(iconColor) : undefined
              }
              rightIcon={
                option.icon && option.iconPosition !== 'left' ? option.icon(iconColor) : undefined
              }
              onPress={() => {
                if (isDisabled || isSelected) {
                  return
                }

                onValueChange(option.value)
              }}>
              <Text
                weight="semibold"
                variant="caption"
                style={[
                  styles.segmentLabel,
                  isSelected ? styles.segmentLabelSelected : styles.segmentLabelUnselected,
                ]}>
                {option.label}
              </Text>
            </Button>
          </View>
        )
      })}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: t.colors.background.card,
    borderRadius: t.borderRadius.lg,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: t.borderRadius.lg,
    backgroundColor: t.colors.primary.main,
  },
  segmentWrapper: {
    minWidth: 0,
    zIndex: 1,
  },
  segmentButton: {
    width: '100%',
  },
  segmentEqualWidth: {
    flex: 1,
  },
  segmentLabel: {
    textAlign: 'center',
  },
  segmentLocked: {
    opacity: 0.45,
  },
  segmentLabelSelected: {
    color: t.colors.text.inverse,
  },
  segmentLabelUnselected: {
    color: t.colors.primary.main,
  },
}))
