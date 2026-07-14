import {
  type GestureResponderEvent,
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native'

import type { ResolvedTheme } from '@/theme'
import { useThemedStyles } from '@/theme'
import { haptics, type HapticType } from '@/utils/haptics'

type PressableVariant = 'default' | 'surface' | 'ghost'
type PressableSize = 'sm' | 'md' | 'lg'

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  activeOpacity?: number
  variant?: PressableVariant
  size?: PressableSize
  haptic?: boolean
  hapticType?: HapticType
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>)
}

export const Pressable = ({
  activeOpacity = 0.7,
  variant = 'ghost',
  size,
  haptic = false,
  hapticType = 'light',
  style,
  disabled,
  onPress,
  ...restProps
}: PressableProps) => {
  const styles = useThemedStyles(createStyles)

  const handlePress =
    onPress && haptic
      ? (e: GestureResponderEvent) => {
          void haptics[hapticType]()
          onPress(e)
        }
      : onPress

  return (
    <RNPressable
      disabled={disabled}
      onPress={handlePress}
      style={(state) => {
        const userStyle = typeof style === 'function' ? style(state) : style
        return [
          styles.base,
          size && styles.sizes[size],
          styles.variants[variant],
          state.pressed && { opacity: activeOpacity },
          disabled && styles.disabled,
          userStyle,
        ]
      }}
      {...restProps}
    />
  )
}

const createStyles = (t: ResolvedTheme) => ({
  ...StyleSheet.create({
    base: {
      borderRadius: t.borderRadius.md,
    },
    disabled: {
      opacity: 0.5,
    },
  }),
  sizes: StyleSheet.create({
    sm: { paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.sm },
    md: { paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md },
    lg: { paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.lg },
  }),
  variants: StyleSheet.create({
    default: {
      backgroundColor: t.colors.background.card,
    },
    surface: {
      backgroundColor: t.colors.background.surface,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
    },
  }),
})
