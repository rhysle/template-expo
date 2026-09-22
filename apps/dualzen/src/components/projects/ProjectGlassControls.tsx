import { Pressable as BasePressable, Text } from '@shared/core/components/base'
import { withAlpha } from '@shared/core/utils/color'
import { BlurView } from 'expo-blur'
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform, type StyleProp, View, type ViewStyle } from 'react-native'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

export function useProjectGlass() {
  const { appearance } = useTheme()
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

  return {
    appearance,
    blurAvailable: Platform.OS === 'ios' && !reduceTransparency,
    glassAvailable:
      Platform.OS === 'ios' &&
      !reduceTransparency &&
      isGlassEffectAPIAvailable() &&
      isLiquidGlassAvailable(),
  } as const
}

export interface ProjectGlassSurfaceProps {
  appearance: 'light' | 'dark'
  blurAvailable: boolean
  children: ReactNode
  glassAvailable: boolean
  interactive?: boolean
  style?: StyleProp<ViewStyle>
}

export function ProjectGlassSurface({
  appearance,
  blurAvailable,
  children,
  glassAvailable,
  interactive = false,
  style,
}: ProjectGlassSurfaceProps) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  if (glassAvailable)
    return (
      <GlassView
        colorScheme={appearance}
        glassEffectStyle="regular"
        tintColor={withAlpha(colors.background.surface, 0.3)}
        isInteractive={interactive}
        pointerEvents={interactive ? 'auto' : 'none'}
        style={[styles.surface, style]}>
        {children}
      </GlassView>
    )
  if (blurAvailable)
    return (
      <BlurView
        tint={appearance}
        intensity={60}
        pointerEvents={interactive ? 'auto' : 'none'}
        style={[styles.surface, styles.frosted, style]}>
        {children}
      </BlurView>
    )
  return (
    <View
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[styles.surface, styles.solid, style]}>
      {children}
    </View>
  )
}

interface ProjectGlassActionButtonProps extends Pick<
  ProjectGlassSurfaceProps,
  'appearance' | 'blurAvailable' | 'glassAvailable'
> {
  accessibilityLabel?: string
  disabled?: boolean
  icon?: ReactNode
  label?: string
  onPress: () => void
  shape?: 'pill' | 'circle'
}

export function ProjectGlassActionButton({
  accessibilityLabel,
  appearance,
  blurAvailable,
  disabled,
  glassAvailable,
  icon,
  label,
  onPress,
  shape = 'pill',
}: ProjectGlassActionButtonProps) {
  const styles = useThemedStyles(createStyles)
  return (
    <BasePressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic
      hapticType="selection"
      onPress={onPress}
      style={[styles.action, shape === 'circle' && styles.circle]}>
      <ProjectGlassSurface
        appearance={appearance}
        blurAvailable={blurAvailable}
        glassAvailable={glassAvailable}
        interactive
        style={[styles.actionSurface, shape === 'circle' && styles.circleSurface]}>
        {icon}
        {label && <Text weight="semibold">{label}</Text>}
      </ProjectGlassSurface>
    </BasePressable>
  )
}

const createStyles = createThemedStyles((theme) => ({
  action: {
    minHeight: theme.spacing['5xl'],
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.md,
  },
  circle: {
    width: theme.spacing['5xl'],
    height: theme.spacing['5xl'],
  },
  surface: {
    borderRadius: theme.borderRadius.full,
  },
  actionSurface: {
    minHeight: theme.spacing['5xl'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  circleSurface: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 0,
  },
  frosted: {
    overflow: 'hidden',
    backgroundColor: withAlpha(theme.colors.background.surface, 0.8),
  },
  solid: { backgroundColor: theme.colors.background.surface },
}))
