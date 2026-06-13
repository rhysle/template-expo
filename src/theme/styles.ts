import { StyleSheet } from 'react-native'

import { useTheme } from './'
import type { CommonStyles, ResolvedTheme } from './types'

export function getCommonStyles(theme: ResolvedTheme): CommonStyles {
  const { colors: c, spacing: s, typography: t, borderRadius, shadows: sh } = theme
  return {
    screen: {
      backgroundColor: c.background.base,
      flex: 1,
      paddingHorizontal: s.lg,
    },
    container: {
      flex: 1,
      backgroundColor: c.background.base,
    },
    card: {
      backgroundColor: c.background.card,
      borderRadius: borderRadius.lg,
      padding: s.lg,
      marginBottom: s.md,
      ...sh.md,
    },
    text: {
      color: c.text.primary,
      fontSize: t.sizes.base,
      fontFamily: t.fontFamily.regular,
      fontWeight: t.weights.regular,
    },
    title: {
      fontSize: t.sizes['4xl'],
      fontFamily: t.fontFamily.bold,
      fontWeight: t.weights.bold,
      color: c.text.primary,
    },
    subtitle: {
      fontSize: t.sizes['2xl'],
      fontFamily: t.fontFamily.semibold,
      fontWeight: t.weights.semibold,
      color: c.text.primary,
    },
    body: {
      fontSize: t.sizes.base,
      fontFamily: t.fontFamily.regular,
      fontWeight: t.weights.regular,
      color: c.text.secondary,
    },
    caption: {
      fontSize: t.sizes.sm,
      fontFamily: t.fontFamily.regular,
      fontWeight: t.weights.regular,
      color: c.text.muted,
    },
  }
}

export function createThemedStyles<
  T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>,
>(createStylesFunc: (theme: ResolvedTheme) => T) {
  return (theme: ResolvedTheme) => StyleSheet.create(createStylesFunc(theme))
}

export function useCommonStyles() {
  const theme = useTheme()
  return getCommonStyles(theme)
}

export function useThemedStyles<T>(styleFactory: (theme: ResolvedTheme) => T): T {
  const theme = useTheme()
  return styleFactory(theme)
}
