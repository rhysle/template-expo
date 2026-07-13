import { BlurView } from 'expo-blur'
import type { Icon } from 'phosphor-react-native'
import {
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
  XCircleIcon,
  XIcon,
} from 'phosphor-react-native'
import { Platform, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated'

import type { SnackbarAction, SnackbarVariant } from '@/stores/features/snackbar'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

import { useTabBarHeight } from './FloatingTabBar'
import { Pressable } from './Pressable'
import { Text } from './Text'

export interface SnackbarProps {
  progress: SharedValue<number>
  title: string
  subtitle?: string
  variant?: SnackbarVariant
  /** undefined = use variant default icon; null = force no icon; Icon = custom icon */
  icon?: Icon | null
  action?: SnackbarAction
  onAction?: () => void
  onDismiss: () => void
  bottomOffset?: number
  showAccent?: boolean
  showShadow?: boolean
  blur?: boolean
  blurIntensity?: number
}

const VARIANT_ICONS: Record<Exclude<SnackbarVariant, 'default'>, Icon> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: WarningCircleIcon,
  neutral: InfoIcon,
}

export const Snackbar = ({
  progress,
  title,
  subtitle,
  variant = 'default',
  icon,
  action,
  onAction,
  onDismiss,
  bottomOffset = 0,
  showAccent = false,
  showShadow = true,
  blur = true,
  blurIntensity = 60,
}: SnackbarProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const tabBarHeight = useTabBarHeight()

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [20, 0]) }],
  }))

  const bottom = tabBarHeight + bottomOffset

  // Resolve which icon to render:
  // null  → no icon (explicit override)
  // Icon  → custom component
  // undef + typed variant → variant default
  // undef + 'default' variant → no icon
  const resolvedIcon: Icon | null =
    icon === null
      ? null
      : icon !== undefined
        ? icon
        : variant !== 'default'
          ? VARIANT_ICONS[variant]
          : null

  const variantStatusColor =
    variant !== 'default'
      ? (
          {
            success: colors.status.success,
            error: colors.status.error,
            warning: colors.status.warning,
            neutral: colors.status.neutral,
          } as const
        )[variant]
      : null

  // Top-align icon + dismiss with first text line when subtitle forces a second line.
  // When single-line, center-align keeps the layout balanced.
  const isTopAligned = Boolean(subtitle)

  const contentStyle = [
    styles.content,
    isTopAligned ? styles.contentTopAligned : styles.contentCentered,
    showAccent
      ? {
          borderLeftWidth: 2,
          borderRightWidth: 2,
          borderLeftColor: variantStatusColor ?? colors.primary.main,
          borderRightColor: variantStatusColor ?? colors.primary.main,
        }
      : { borderLeftWidth: 0, borderRightWidth: 0 },
    showShadow ? styles.contentShadow : undefined,
    blur && Platform.OS === 'ios' ? styles.contentBlur : undefined,
  ]

  const snackbarContent = (
    <>
      {resolvedIcon
        ? (() => {
            const IconComp = resolvedIcon
            return (
              <IconComp
                size={iconSizes.md}
                color={variantStatusColor ?? colors.text.secondary}
                weight="regular"
              />
            )
          })()
        : null}

      <View style={styles.textBlock}>
        <Text variant="body" weight="semibold">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action && onAction ? (
        <Pressable
          onPress={onAction}
          haptic
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={styles.action}>
          <Text variant="body" weight="bold" style={styles.actionText}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onDismiss}
        haptic
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        style={styles.dismiss}>
        <XIcon size={iconSizes.sm} color={colors.text.muted} weight="regular" />
      </Pressable>
    </>
  )

  return (
    <Animated.View style={[styles.container, { bottom }, animatedStyle]}>
      {Platform.OS === 'ios' && blur ? (
        <BlurView intensity={blurIntensity} tint="systemMaterial" style={contentStyle}>
          {snackbarContent}
        </BlurView>
      ) : (
        <View style={contentStyle}>{snackbarContent}</View>
      )}
    </Animated.View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    position: 'absolute',
    left: t.spacing['3xl'],
    right: t.spacing['3xl'],
    zIndex: 50,
  },
  content: {
    backgroundColor: t.colors.background.surface,
    borderRadius: t.borderRadius.xl,
    paddingVertical: t.spacing.lg,
    paddingHorizontal: t.spacing.lg,
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  contentShadow: {
    ...t.shadows.lg,
    shadowColor: t.colors.shadow.base,
  },
  contentBlur: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  contentCentered: {
    alignItems: 'center',
  },
  contentTopAligned: {
    alignItems: 'flex-start',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    // Small top nudge so the icon circle visually aligns with the first text line.
    // Fine-tune (2–4 px) after visual review if needed.
    marginTop: 2,
  },
  iconWrapperDefault: {
    backgroundColor: withAlpha(t.colors.text.muted, 0.12),
  },
  textBlock: {
    flex: 1,
  },
  subtitle: {
    marginTop: t.spacing.xs,
  },
  action: {
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
  },
  actionText: {
    color: t.colors.primary.main,
  },
  dismiss: {
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.xs,
  },
}))
