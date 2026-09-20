import { NativeBottomSheet, Text } from '@shared/core/components/base'
import { FrameCornersIcon, GearSixIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

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
      contentContainerStyle={styles.content}>
      <Text variant="subtitle" weight="semibold" align="center">
        {t('camera.quickSettings')}
      </Text>
      <View style={styles.actions}>
        {actions.map(({ id, label, icon: Icon }) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onAction(id)}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
            <View style={styles.actionIcon}>
              <Icon size={iconSizes.xl} color={theme.colors.text.primary} />
            </View>
            <Text variant="label" weight="semibold" align="center" numberOfLines={2}>
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
    paddingTop: theme.spacing.sm,
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
  actionPressed: { opacity: 0.7 },
  actionIcon: {
    width: theme.spacing['7xl'],
    height: theme.spacing['7xl'],
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.background.subtle,
  },
}))
