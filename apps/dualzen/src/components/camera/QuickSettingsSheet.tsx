import { NativeBottomSheet, Text } from '@shared/core/components/base'
import { withAlpha } from '@shared/core/utils/color'
import { BlurView } from 'expo-blur'
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect'
import { FrameCornersIcon, GearSixIcon } from 'phosphor-react-native'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

export type QuickSettingsAction = 'framing' | 'settings'

export function QuickSettingsSheet({
  visible,
  onAction,
  onDismiss,
}: {
  visible: boolean
  onAction: (action: QuickSettingsAction) => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
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

  const renderActionIcon = (icon: ReactNode) => {
    if (liquidGlass) {
      return (
        <GlassView
          colorScheme={theme.appearance}
          glassEffectStyle="regular"
          tintColor={withAlpha(theme.colors.background.surface, 0.3)}
          isInteractive
          pointerEvents="none"
          style={styles.actionIcon}>
          {icon}
        </GlassView>
      )
    }

    if (Platform.OS === 'ios' && !reduceTransparency) {
      return (
        <BlurView
          tint={theme.appearance}
          intensity={60}
          pointerEvents="none"
          style={[styles.actionIcon, styles.frostedActionIcon]}>
          {icon}
        </BlurView>
      )
    }

    return (
      <View pointerEvents="none" style={[styles.actionIcon, styles.solidActionIcon]}>
        {icon}
      </View>
    )
  }

  const actions = [
    {
      id: 'framing' as const,
      label: t('camera.framing'),
      icon: FrameCornersIcon,
    },
    {
      id: 'settings' as const,
      label: t('camera.moreSettings'),
      icon: GearSixIcon,
    },
  ]

  return (
    <NativeBottomSheet
      visible={visible}
      onDismiss={onDismiss}
      preset="content"
      backgroundVariant="translucent"
      contentContainerStyle={styles.content}>
      <View style={styles.actions}>
        {actions.map(({ id, label, icon: Icon }) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onAction(id)}
            style={styles.action}>
            {renderActionIcon(
              <Icon size={iconSizes.xl} color={theme.colors.text.primary} weight="thin" />
            )}
            <Text
              variant="label"
              weight="semibold"
              align="center"
              numberOfLines={2}
              style={styles.actionLabel}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </NativeBottomSheet>
  )
}

const createStyles = createThemedStyles((theme) => ({
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
    gap: theme.spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing['3xl'],
  },
  action: {
    width: theme.spacing['7xl'] + theme.spacing['3xl'],
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  actionLabel: { textTransform: 'uppercase' },
  actionIcon: {
    width: theme.spacing['7xl'],
    height: theme.spacing['7xl'],
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frostedActionIcon: {
    backgroundColor: withAlpha(theme.colors.background.surface, 0.35),
  },
  solidActionIcon: { backgroundColor: theme.colors.background.subtle },
}))
