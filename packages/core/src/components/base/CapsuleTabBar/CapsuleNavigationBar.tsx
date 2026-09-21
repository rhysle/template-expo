import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@shared/core/theme'
import { withAlpha } from '@shared/core/utils/color'
import { BlurView } from 'expo-blur'
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AccessibilityInfo, Keyboard, Platform, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
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
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
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
  leadingAccessory?: ReactNode
  trailingAccessory?: ReactNode
}

export interface CapsuleNavigationAccessoryProps {
  accessibilityLabel: string
  children: ReactNode
  disabled?: boolean
  onPress: () => void
  testID?: string
}

/** Circular companion control designed to sit beside a capsule navigation bar. */
export function CapsuleNavigationAccessory({
  accessibilityLabel,
  children,
  disabled,
  onPress,
  testID,
}: CapsuleNavigationAccessoryProps) {
  const styles = useThemedStyles(createStyles)
  const { appearance, colors } = useTheme()
  const [reduceTransparency, setReduceTransparency] = useState(true)

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

  const liquidGlass =
    Platform.OS === 'ios' &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable()
  const content = <View style={styles.accessoryContent}>{children}</View>
  const surface = liquidGlass ? (
    <GlassView
      colorScheme={appearance}
      glassEffectStyle="regular"
      tintColor={withAlpha(colors.background.surface, 0.3)}
      isInteractive
      pointerEvents="none"
      style={styles.accessorySurface}>
      {content}
    </GlassView>
  ) : Platform.OS === 'ios' && !reduceTransparency ? (
    <BlurView
      tint={appearance}
      intensity={60}
      pointerEvents="none"
      style={[styles.accessorySurface, styles.frosted]}>
      {content}
    </BlurView>
  ) : (
    <View pointerEvents="none" style={[styles.accessorySurface, styles.solid]}>
      {content}
    </View>
  )

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      haptic
      hapticType="selection"
      style={[styles.accessoryShadow, disabled && styles.accessoryDisabled]}>
      {surface}
    </Pressable>
  )
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
      allowRapidPress
      style={styles.item}>
      {item.renderIcon(iconColor, iconSizes.lg)}
    </Pressable>
  )
}

/** Controlled capsule navigation surface for route tabs and virtual navigation actions. */
export function CapsuleNavigationBar({
  items,
  hideOnKeyboard = true,
  leadingAccessory,
  trailingAccessory,
}: CapsuleNavigationBarProps) {
  const styles = useThemedStyles(createStyles)
  const { appearance, colors, spacing } = useTheme()
  const insets = useSafeAreaInsets()
  const setHeight = useSetTabBarHeight()
  const [reduceTransparency, setReduceTransparency] = useState(true)
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible())
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const pressed = useSharedValue(false)
  const hovered = useSharedValue(false)
  const androidGlowX = useSharedValue(0)
  const androidGlowY = useSharedValue(0)
  const androidGlowOpacity = useSharedValue(0)
  const androidPillWidth = useSharedValue(0)
  const hidden = hideOnKeyboard && keyboardVisible
  const androidGlowSize = spacing['8xl']
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
  const androidGlowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: androidGlowOpacity.value,
    transform: [
      { translateX: androidGlowX.value - androidGlowSize / 2 },
      { translateY: androidGlowY.value - androidGlowSize / 2 },
    ],
  }))
  const androidTouchGesture = useMemo(
    () =>
      Gesture.Manual()
        .shouldCancelWhenOutside(false)
        .onTouchesDown((event) => {
          const touch = event.allTouches[0]
          if (!touch) return

          pressed.value = true
          androidGlowX.value = Math.max(0, Math.min(touch.x, androidPillWidth.value))
          androidGlowY.value = touch.y
          androidGlowOpacity.value = withTiming(1, {
            duration: 120,
            reduceMotion: ReduceMotion.System,
          })
        })
        .onTouchesMove((event) => {
          const touch = event.allTouches[0]
          if (!touch) return

          androidGlowX.value = Math.max(0, Math.min(touch.x, androidPillWidth.value))
          androidGlowY.value = touch.y
        })
        .onTouchesUp((event, stateManager) => {
          if (event.numberOfTouches > 0) return

          pressed.value = false
          androidGlowOpacity.value = withTiming(0, {
            duration: 180,
            reduceMotion: ReduceMotion.System,
          })
          stateManager.fail()
        })
        .onTouchesCancelled((_event, stateManager) => {
          pressed.value = false
          androidGlowOpacity.value = withTiming(0, {
            duration: 180,
            reduceMotion: ReduceMotion.System,
          })
          stateManager.fail()
        }),
    [androidGlowOpacity, androidGlowX, androidGlowY, androidPillWidth, pressed]
  )

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
      androidGlowOpacity.value = 0
    }
    setHeight(hidden ? 0 : measuredHeight)
  }, [hidden, measuredHeight, setHeight, pressed, hovered, androidGlowOpacity])

  useEffect(() => () => setHeight(0), [setHeight])

  if (hidden) return null

  const content = items.map((item) => <CapsuleNavigationBarItem key={item.key} item={item} />)
  const liquidGlass =
    Platform.OS === 'ios' &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable()
  const solidPill = (
    <View
      style={[styles.pill, styles.solid, Platform.OS === 'android' && styles.androidPill]}
      onLayout={(event) => {
        androidPillWidth.value = event.nativeEvent.layout.width
      }}>
      {Platform.OS === 'android' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.androidGlow,
            { width: androidGlowSize, height: androidGlowSize },
            androidGlowAnimatedStyle,
          ]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="capsuleAndroidGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.text.primary} stopOpacity={0.12} />
                <Stop offset="42%" stopColor={colors.text.primary} stopOpacity={0.06} />
                <Stop offset="100%" stopColor={colors.text.primary} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#capsuleAndroidGlow)" />
          </Svg>
        </Animated.View>
      ) : null}
      {content}
    </View>
  )

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: insets.bottom + spacing.sm }]}
      onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}>
      <View pointerEvents="box-none" style={styles.barRow}>
        <View pointerEvents="box-none" style={styles.leadingAccessory}>
          {leadingAccessory}
        </View>
        <Animated.View
          style={[
            styles.shadow,
            Boolean(leadingAccessory || trailingAccessory) && styles.shadowWithAccessories,
            capsuleAnimatedStyle,
          ]}
          onTouchStart={
            Platform.OS === 'android'
              ? undefined
              : () => {
                  pressed.value = true
                }
          }
          onTouchEnd={
            Platform.OS === 'android'
              ? undefined
              : () => {
                  pressed.value = false
                }
          }
          onTouchCancel={
            Platform.OS === 'android'
              ? undefined
              : () => {
                  pressed.value = false
                }
          }
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
              tintColor={withAlpha(colors.background.surface, 0.3)}
              isInteractive
              style={styles.pill}>
              {content}
            </GlassView>
          ) : Platform.OS === 'ios' && !reduceTransparency ? (
            <BlurView tint={appearance} intensity={60} style={[styles.pill, styles.frosted]}>
              {content}
            </BlurView>
          ) : Platform.OS === 'android' ? (
            <GestureDetector gesture={androidTouchGesture}>{solidPill}</GestureDetector>
          ) : (
            solidPill
          )}
        </Animated.View>
        <View pointerEvents="box-none" style={styles.trailingAccessory}>
          {trailingAccessory}
        </View>
      </View>
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
  barRow: {
    width: '100%',
    minHeight: t.spacing['5xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingAccessory: { position: 'absolute', left: 0 },
  trailingAccessory: { position: 'absolute', right: 0 },
  shadow: { maxWidth: '100%', borderRadius: t.borderRadius.full, ...t.shadows.md },
  shadowWithAccessories: { maxWidth: '60%' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.borderRadius.full,
    paddingHorizontal: t.spacing.sm,
  },
  frosted: { backgroundColor: withAlpha(t.colors.background.surface, 0.8) },
  solid: { backgroundColor: t.colors.background.surface },
  androidPill: { overflow: 'hidden' },
  androidGlow: { position: 'absolute', left: 0, top: 0 },
  item: {
    width: t.spacing['6xl'],
    height: t.spacing['5xl'],
    flexShrink: 1,
    minWidth: t.spacing['5xl'],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: t.borderRadius.full,
  },
  accessoryShadow: {
    width: t.spacing['5xl'],
    height: t.spacing['5xl'],
    borderRadius: t.borderRadius.full,
    ...t.shadows.md,
  },
  accessorySurface: {
    width: '100%',
    height: '100%',
    borderRadius: t.borderRadius.full,
    overflow: 'hidden',
  },
  accessoryContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  accessoryDisabled: { opacity: 0.4 },
}))
