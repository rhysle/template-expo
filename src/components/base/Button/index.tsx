import type { ReactNode } from 'react'
import {
  type GestureResponderEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import Animated from 'react-native-reanimated'

import { BouncingDotsLoader, PulsingRingLoader, SpinArcLoader } from '@/components/base/Loader'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { Pressable, type PressableProps } from '../Pressable'
import { Text } from '../Text'
import { useButtonAnimation } from './pressAnimations/useButtonAnimation'
import type { AnimationType, LoadingAnimationType } from './types'

const loaders = {
  'spin-arc': SpinArcLoader,
  'bouncing-dots': BouncingDotsLoader,
  'pulsing-ring': PulsingRingLoader,
} as const satisfies Record<LoadingAnimationType, unknown>

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverted' | 'outlined'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<PressableProps, 'children' | 'variant' | 'size'> {
  label?: string
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
  disabled?: boolean
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  animationType?: AnimationType
  loadingAnimation?: LoadingAnimationType
}

export const Button = ({
  label,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  fullWidth = false,
  disabled = false,
  style,
  children,
  animationType = 'none',
  loadingAnimation = 'bouncing-dots',
  onPressIn: userPressIn,
  onPressOut: userPressOut,
  ...props
}: ButtonProps) => {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const isDisabled = disabled || loading
  const { outerStyle, overlayStyle, onPressIn, onPressOut, disableOpacity } =
    useButtonAnimation(animationType)
  const Loader = loaders[loadingAnimation]

  const indicatorColor: Record<ButtonVariant, string> = {
    primary: theme.colors.text.inverse,
    secondary: theme.colors.text.primary,
    ghost: theme.colors.primary.main,
    danger: theme.colors.text.inverse,
    inverted: theme.colors.primary.main,
    outlined: theme.colors.primary.main,
  }

  const handlePressIn = (e: GestureResponderEvent) => {
    onPressIn()
    userPressIn?.(e)
  }

  const handlePressOut = (e: GestureResponderEvent) => {
    onPressOut()
    userPressOut?.(e)
  }

  const sizeStyle = { sm: styles.sizeSm, md: styles.sizeMd, lg: styles.sizeLg }[size]
  const variantStyle = {
    primary: styles.variantPrimary,
    secondary: styles.variantSecondary,
    ghost: styles.variantGhost,
    danger: styles.variantDanger,
    inverted: styles.variantInverted,
    outlined: styles.variantOutlined,
  }[variant]
  const labelStyle = {
    primary: styles.labelPrimary,
    secondary: styles.labelSecondary,
    ghost: styles.labelGhost,
    danger: styles.labelDanger,
    inverted: styles.labelInverted,
    outlined: styles.labelOutlined,
  }[variant]

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, style, outerStyle]}>
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        variant="ghost"
        size={size}
        activeOpacity={disableOpacity ? 1 : 0.7}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.base, variantStyle, sizeStyle]}
        {...props}>
        <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="none" />
        {loading ? (
          <Loader color={indicatorColor[variant]} />
        ) : (
          <>
            {leftIcon ? <View style={styles.iconWrapper}>{leftIcon}</View> : null}
            {children ?? (
              <Text weight="semibold" style={labelStyle}>
                {label}
              </Text>
            )}
            {rightIcon ? <View style={styles.iconWrapper}>{rightIcon}</View> : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  )
}

const createStyles = createThemedStyles((t) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.lg,
    gap: t.spacing.xs,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeSm: { paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md },
  sizeMd: { paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.lg },
  sizeLg: { paddingVertical: t.spacing.lg, paddingHorizontal: t.spacing.xl },
  variantPrimary: { backgroundColor: t.colors.primary.main },
  variantSecondary: { backgroundColor: t.colors.background.subtle },
  variantGhost: { backgroundColor: 'transparent' },
  variantDanger: { backgroundColor: t.colors.status.error },
  variantInverted: { backgroundColor: t.colors.background.base },
  variantOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: t.colors.primary.main,
  },
  labelPrimary: { color: t.colors.text.inverse },
  labelSecondary: { color: t.colors.text.primary },
  labelGhost: { color: t.colors.primary.main },
  labelDanger: { color: t.colors.text.inverse },
  labelInverted: { color: t.colors.primary.main },
  labelOutlined: { color: t.colors.primary.main },
}))
