import type { Icon, IconWeight } from 'phosphor-react-native'
import { ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { Pressable, type PressableProps } from './Pressable'

type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outlined' | 'danger'
type IconButtonSize = 'sm' | 'md' | 'lg' | 'xl'

export interface IconButtonProps extends Omit<
  PressableProps,
  'accessibilityLabel' | 'children' | 'size' | 'style' | 'variant'
> {
  icon: Icon
  accessibilityLabel: string
  variant?: IconButtonVariant
  size?: IconButtonSize
  iconWeight?: IconWeight
  selected?: boolean
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export const IconButton = ({
  icon: IconComponent,
  accessibilityLabel,
  variant = 'ghost',
  size = 'md',
  iconWeight = 'regular',
  selected = false,
  loading = false,
  disabled = false,
  haptic = true,
  accessibilityState,
  style,
  ...props
}: IconButtonProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const isDisabled = disabled || loading
  const showSelectedTreatment = selected && variant !== 'primary' && variant !== 'danger'

  const variantStyle = {
    primary: styles.variantPrimary,
    secondary: styles.variantSecondary,
    ghost: styles.variantGhost,
    outlined: styles.variantOutlined,
    danger: styles.variantDanger,
  }[variant]

  const variantColor = {
    primary: colors.text.inverse,
    secondary: colors.text.primary,
    ghost: colors.text.primary,
    outlined: colors.primary.main,
    danger: colors.text.inverse,
  }[variant]

  const sizeStyle = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
    xl: styles.sizeXl,
  }[size]

  const iconSize = {
    sm: iconSizes.sm,
    md: iconSizes.md,
    lg: iconSizes.lg,
    xl: iconSizes.xl,
  }[size]

  const iconColor = showSelectedTreatment ? colors.primary.main : variantColor

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{
        ...accessibilityState,
        busy: loading,
        disabled: isDisabled,
        selected,
      }}
      disabled={isDisabled}
      haptic={haptic && !isDisabled}
      style={[
        styles.base,
        variantStyle,
        sizeStyle,
        showSelectedTreatment && styles.selected,
        style,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <IconComponent size={iconSize} color={iconColor} weight={iconWeight} />
      )}
    </Pressable>
  )
}

const createStyles = createThemedStyles((t) => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 0,
  },
  sizeSm: {
    width: 44,
    height: 44,
  },
  sizeMd: {
    width: 48,
    height: 48,
  },
  sizeLg: {
    width: 56,
    height: 56,
  },
  sizeXl: {
    width: 64,
    height: 64,
  },
  variantPrimary: {
    backgroundColor: t.colors.primary.main,
  },
  variantSecondary: {
    backgroundColor: t.colors.background.subtle,
  },
  variantGhost: {
    backgroundColor: 'transparent',
  },
  variantOutlined: {
    backgroundColor: 'transparent',
    borderColor: t.colors.border.default,
  },
  variantDanger: {
    backgroundColor: t.colors.status.error,
  },
  selected: {
    backgroundColor: t.colors.primary.soft,
    borderColor: t.colors.primary.main,
  },
}))
