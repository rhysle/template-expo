import { NativeBottomSheet, Text } from '@shared/core/components/base'
import { withAlpha } from '@shared/core/utils/color'
import {
  FlipHorizontalIcon,
  FrameCornersIcon,
  GearSixIcon,
  GridNineIcon,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { useCameraState } from '@/stores/features/camera'
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
  const { sharedSettings, updateSharedSettings, phase } = useCameraState()

  const actions = [
    {
      id: 'framing' as const,
      label: t('camera.framing'),
      icon: FrameCornersIcon,
      onPress: () => onAction('framing'),
    },
    {
      id: 'grid' as const,
      label: t('camera.grid'),
      icon: GridNineIcon,
      selected: sharedSettings.grid,
      onPress: () => updateSharedSettings({ grid: !sharedSettings.grid }),
    },
    {
      id: 'mirror-front-camera' as const,
      label: t('camera.mirrorFrontCameraQuick'),
      accessibilityLabel: t('camera.mirrorFrontCamera'),
      icon: FlipHorizontalIcon,
      selected: sharedSettings.mirrorFrontCamera,
      disabled: phase !== 'idle',
      onPress: () => updateSharedSettings({ mirrorFrontCamera: !sharedSettings.mirrorFrontCamera }),
    },
    {
      id: 'settings' as const,
      label: t('camera.moreSettings'),
      icon: GearSixIcon,
      onPress: () => onAction('settings'),
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
        {actions.map(
          ({
            id,
            label,
            accessibilityLabel,
            icon: Icon,
            onPress,
            selected = false,
            disabled = false,
          }) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel ?? label}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={onPress}
              style={[styles.action, disabled && styles.actionDisabled]}>
              <View pointerEvents="none" style={styles.actionIcon}>
                <Icon
                  size={iconSizes.xl}
                  color={selected ? theme.colors.primary.main : theme.colors.text.primary}
                  weight="thin"
                />
              </View>
              <Text
                variant="label"
                weight="semibold"
                align="center"
                numberOfLines={2}
                style={[styles.actionLabel, selected && styles.actionLabelSelected]}>
                {label}
              </Text>
            </Pressable>
          )
        )}
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
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    gap: theme.spacing.md,
  },
  action: {
    width: '29%',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  actionDisabled: { opacity: 0.5 },
  actionLabel: { textTransform: 'uppercase' },
  actionLabelSelected: { color: theme.colors.primary.main },
  actionIcon: {
    width: theme.spacing['7xl'],
    height: theme.spacing['7xl'],
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(theme.colors.background.surface, 0.4),
  },
}))
