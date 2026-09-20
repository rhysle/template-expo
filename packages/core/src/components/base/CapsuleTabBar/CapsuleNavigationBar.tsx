import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@shared/core/theme'
import { withAlpha } from '@shared/core/utils/color'
import { BlurView } from 'expo-blur'
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Keyboard, Platform, View } from 'react-native'
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { useSetTabBarHeight } from '../FloatingTabBar/tabBarHeight'
import { Pressable } from '../Pressable'

export interface CapsuleNavigationItem {
  key: string
  label: string
  selected: boolean
  disabled?: boolean
  renderIcon: (color: string, size: number) => ReactNode
  onPress: () => void
  onLongPress?: () => void
  testID?: string
}

export interface CapsuleNavigationBarProps {
  items: readonly CapsuleNavigationItem[]
  hideOnKeyboard?: boolean
}

function CapsuleNavigationBarItem({ item }: { item: CapsuleNavigationItem }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const inactiveColor = colors.text.muted
  const activeColor = colors.text.primary
  const progress = useSharedValue(item.selected ? 1 : 0)
  const [iconColor, setIconColor] = useState(item.selected ? activeColor : inactiveColor)

  useEffect(() => {
    progress.value = withTiming(item.selected ? 1 : 0, {
      duration: 220,
      reduceMotion: ReduceMotion.System,
    })
  }, [item.selected, progress])

  useAnimatedReaction(
    () => interpolateColor(progress.value, [0, 1], [inactiveColor, activeColor]),
    (nextColor, previousColor) => {
      if (nextColor !== previousColor) scheduleOnRN(setIconColor, nextColor)
    }
  )

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.selected, disabled: item.disabled }}
      disabled={item.disabled}
      onPress={item.onPress}
      onLongPress={item.onLongPress}
      testID={item.testID}
      haptic={!item.selected}
      hapticType="selection"
      allowRapidPress
      style={styles.item}>
      {item.renderIcon(iconColor, iconSizes.lg)}
    </Pressable>
  )
}

/** Controlled capsule navigation surface for route tabs and virtual navigation actions. */
export function CapsuleNavigationBar({ items, hideOnKeyboard = true }: CapsuleNavigationBarProps) {
  const styles = useThemedStyles(createStyles)
  const { appearance, colors, spacing } = useTheme()
  const insets = useSafeAreaInsets()
  const setHeight = useSetTabBarHeight()
  const [reduceTransparency, setReduceTransparency] = useState(true)
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible())
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const pressed = useSharedValue(false)
  const hovered = useSharedValue(false)
  const hidden = hideOnKeyboard && keyboardVisible
  const capsuleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(pressed.value || hovered.value ? 1.045 : 1, {
          damping: 18,
          stiffness: 260,
          mass: 0.75,
          reduceMotion: ReduceMotion.System,
        }),
      },
    ],
  }))

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    let active = true
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (active) setReduceTransparency(value)
      })
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    )
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    if (!hideOnKeyboard) return
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [hideOnKeyboard])

  useEffect(() => {
    if (hidden) {
      pressed.value = false
      hovered.value = false
    }
    setHeight(hidden ? 0 : measuredHeight)
  }, [hidden, measuredHeight, setHeight, pressed, hovered])

  useEffect(() => () => setHeight(0), [setHeight])

  if (hidden) return null

  const content = items.map((item) => <CapsuleNavigationBarItem key={item.key} item={item} />)
  const liquidGlass =
    Platform.OS === 'ios' &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable()

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: insets.bottom + spacing.sm }]}
      onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}>
      <Animated.View
        style={[styles.shadow, capsuleAnimatedStyle]}
        onTouchStart={() => {
          pressed.value = true
        }}
        onTouchEnd={() => {
          pressed.value = false
        }}
        onTouchCancel={() => {
          pressed.value = false
        }}
        onPointerEnter={(event) => {
          if (event.nativeEvent.pointerType !== 'touch') hovered.value = true
        }}
        onPointerLeave={() => {
          hovered.value = false
        }}>
        {liquidGlass ? (
          <GlassView
            colorScheme={appearance}
            glassEffectStyle="regular"
            tintColor={withAlpha(colors.background.surface, appearance === 'dark' ? 0.7 : 0.35)}
            isInteractive
            style={styles.pill}>
            {content}
          </GlassView>
        ) : Platform.OS === 'ios' && !reduceTransparency ? (
          <BlurView tint={appearance} intensity={60} style={[styles.pill, styles.frosted]}>
            {content}
          </BlurView>
        ) : (
          <View style={[styles.pill, styles.solid]}>{content}</View>
        )}
      </Animated.View>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
  },
  shadow: { maxWidth: '100%', borderRadius: t.borderRadius.full, ...t.shadows.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.borderRadius.full,
    paddingHorizontal: t.spacing.sm,
  },
  frosted: { backgroundColor: withAlpha(t.colors.background.surface, 0.8) },
  solid: { backgroundColor: t.colors.background.surface },
  item: {
    width: t.spacing['6xl'],
    height: t.spacing['5xl'],
    flexShrink: 1,
    minWidth: t.spacing['5xl'],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: t.borderRadius.full,
  },
}))
