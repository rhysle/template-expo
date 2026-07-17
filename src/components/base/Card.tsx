import type { ReactNode } from 'react'
import { type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native'

import { createThemedStyles, useThemedStyles } from '@/theme'

type CardVariant = 'default' | 'subtle'
type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends ViewProps {
  variant?: CardVariant
  padding?: CardPadding
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

export const Card = ({
  variant = 'default',
  padding = 'lg',
  style,
  children,
  ...props
}: CardProps) => {
  const styles = useThemedStyles(createStyles)

  const variantStyle = {
    default: styles.variantDefault,
    subtle: styles.variantSubtle,
  }[variant]

  const paddingStyle = {
    none: styles.paddingNone,
    sm: styles.paddingSm,
    md: styles.paddingMd,
    lg: styles.paddingLg,
  }[padding]

  return (
    <View style={[styles.base, variantStyle, paddingStyle, style]} {...props}>
      {children}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  base: {
    overflow: 'hidden',
    borderRadius: t.borderRadius.lg,
  },
  variantDefault: {
    backgroundColor: t.colors.background.card,
    ...t.shadows.sm,
  },
  variantSubtle: {
    backgroundColor: t.colors.background.subtle,
  },
  paddingNone: {},
  paddingSm: { padding: t.spacing.sm },
  paddingMd: { padding: t.spacing.md },
  paddingLg: { padding: t.spacing.lg },
}))
