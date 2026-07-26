import type { Icon } from 'phosphor-react-native'
import { View } from 'react-native'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { Button } from './Button'
import { NativeBottomSheet } from './NativeUI'
import { Text } from './Text'

export interface PermissionSheetProps {
  visible: boolean
  onDismiss: () => void
  icon: Icon
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export const PermissionSheet = ({
  visible,
  onDismiss,
  icon: PermissionIcon,
  title,
  description,
  actionLabel,
  onAction,
}: PermissionSheetProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <NativeBottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <PermissionIcon size={iconSizes.xl} color={colors.primary.main} weight="fill" />
        </View>

        <View style={styles.copy}>
          <Text variant="title" weight="bold" align="center" style={styles.title}>
            {title}
          </Text>
          <Text variant="body" tone="secondary" align="center">
            {description}
          </Text>
        </View>

        <Button label={actionLabel} fullWidth size="lg" haptic onPress={onAction} />
      </View>
    </NativeBottomSheet>
  )
}

const createStyles = createThemedStyles((t) => ({
  content: {
    gap: t.spacing.xl,
    paddingHorizontal: t.spacing['4xl'],
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: t.borderRadius['2xl'],
    backgroundColor: t.colors.primary.soft,
  },
  copy: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  title: {
    fontSize: t.typography.sizes['2xl'],
  },
}))
