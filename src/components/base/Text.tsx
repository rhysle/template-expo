import {
  type StyleProp,
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native'

import type { ResolvedTheme } from '@/theme'
import { useThemedStyles } from '@/theme'

type TextVariant = 'title' | 'subtitle' | 'body' | 'caption' | 'label'
type TextWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold'
type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'inverse'
  | 'inverseSecondary'
  | 'inverseMuted'
type TextAlign = 'auto' | 'left' | 'center' | 'right' | 'justify'

export interface TextProps extends RNTextProps {
  variant?: TextVariant
  weight?: TextWeight
  tone?: TextTone
  align?: TextAlign
  style?: StyleProp<TextStyle>
}

const alignStyles: Record<TextAlign, Pick<TextStyle, 'textAlign'>> = {
  auto: { textAlign: 'auto' },
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
  justify: { textAlign: 'justify' },
}

export function Text({
  variant = 'body',
  weight = 'regular',
  tone = 'primary',
  align = 'auto',
  style,
  children,
  ...props
}: TextProps) {
  const styles = useThemedStyles(createStyles)

  return (
    <RNText
      style={[
        styles.base,
        styles.variants[variant],
        styles.tones[tone],
        styles.weights[weight],
        alignStyles[align],
        style,
      ]}
      {...props}>
      {children}
    </RNText>
  )
}

const createStyles = (t: ResolvedTheme) => ({
  ...StyleSheet.create({
    base: {
      color: t.colors.text.primary,
      fontSize: t.typography.sizes.base,
      fontFamily: t.typography.fontFamily.regular,
      fontWeight: t.typography.weights.regular as TextStyle['fontWeight'],
    },
  }),
  variants: StyleSheet.create({
    title: { fontSize: t.typography.sizes['4xl'] },
    subtitle: { fontSize: t.typography.sizes.lg },
    body: { fontSize: t.typography.sizes.base },
    caption: { fontSize: t.typography.sizes.sm },
    label: { fontSize: t.typography.sizes.base },
  }),
  tones: StyleSheet.create({
    primary: { color: t.colors.text.primary },
    secondary: { color: t.colors.text.secondary },
    muted: { color: t.colors.text.muted },
    accent: { color: t.colors.text.accent },
    success: { color: t.colors.status.success },
    error: { color: t.colors.status.error },
    warning: { color: t.colors.status.warning },
    info: { color: t.colors.status.info },
    inverse: { color: t.colors.text.inverse },
    inverseSecondary: { color: t.colors.text.inverseSecondary },
    inverseMuted: { color: t.colors.text.inverseMuted },
  }),
  weights: StyleSheet.create({
    light: {
      fontFamily: t.typography.fontFamily.light,
      fontWeight: t.typography.weights.light as TextStyle['fontWeight'],
    },
    regular: {
      fontFamily: t.typography.fontFamily.regular,
      fontWeight: t.typography.weights.regular as TextStyle['fontWeight'],
    },
    medium: {
      fontFamily: t.typography.fontFamily.medium,
      fontWeight: t.typography.weights.medium as TextStyle['fontWeight'],
    },
    semibold: {
      fontFamily: t.typography.fontFamily.semibold,
      fontWeight: t.typography.weights.semibold as TextStyle['fontWeight'],
    },
    bold: {
      fontFamily: t.typography.fontFamily.bold,
      fontWeight: t.typography.weights.bold as TextStyle['fontWeight'],
    },
  }),
})
