import type { ReactNode } from 'react'
import { type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native'

import { createThemedStyles, useThemedStyles } from '@/theme'

type CardVariant = 'default' | 'surface' | 'flat'
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
    surface: styles.variantSurface,
    flat: styles.variantFlat,
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
    borderRadius: t.borderRadius.lg,
  },
  variantDefault: {
    backgroundColor: t.colors.background.card,
    borderColor: t.colors.background.surface,
    ...t.shadows.sm,
  },
  variantSurface: {
    backgroundColor: t.colors.background.surface,
    borderColor: t.colors.background.card,
    ...t.shadows.sm,
  },
  variantFlat: {
    backgroundColor: t.colors.background.card,
  },
  paddingNone: {},
  paddingSm: { padding: t.spacing.sm },
  paddingMd: { padding: t.spacing.md },
  paddingLg: { padding: t.spacing.lg },
}))
