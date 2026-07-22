import type { Icon } from 'phosphor-react-native'
import { type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { type ComponentTone, getComponentToneColor, getComponentToneSurface } from './ComponentTone'
import { Text } from './Text'

export interface StatusBadgeProps extends Omit<ViewProps, 'style'> {
  label: string
  tone?: ComponentTone
  icon?: Icon
  style?: StyleProp<ViewStyle>
}

export const StatusBadge = ({
  label,
  tone = 'neutral',
  icon: IconComponent,
  accessibilityLabel,
  accessibilityRole,
  style,
  ...props
}: StatusBadgeProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const toneColor = getComponentToneColor(colors, tone)
  const surfaceColor = getComponentToneSurface(colors, tone)

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={accessibilityRole ?? 'text'}
      style={[styles.container, { backgroundColor: surfaceColor }, style]}
      {...props}>
      {IconComponent ? <IconComponent size={iconSizes.sm} color={toneColor} weight="bold" /> : null}
      <Text variant="caption" weight="semibold" style={styles.label}>
        {label}
      </Text>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    minHeight: 28,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.full,
  },
  label: {
    flexShrink: 1,
  },
}))
