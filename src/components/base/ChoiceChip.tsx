import type { Icon } from 'phosphor-react-native'
import { type StyleProp, type ViewStyle } from 'react-native'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { Pressable, type PressableProps } from './Pressable'
import { Text } from './Text'

export interface ChoiceChipProps extends Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'style' | 'variant'
> {
  label: string
  selected: boolean
  icon?: Icon
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export const ChoiceChip = ({
  label,
  selected,
  icon: IconComponent,
  disabled = false,
  haptic = true,
  accessibilityLabel,
  accessibilityState,
  style,
  ...props
}: ChoiceChipProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const contentColor = selected ? colors.text.inverse : colors.primary.main

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled, selected }}
      disabled={disabled}
      haptic={haptic && !disabled}
      hapticType="selection"
      style={[styles.container, selected ? styles.selected : styles.unselected, style]}
      {...props}>
      {IconComponent ? (
        <IconComponent size={iconSizes.sm} color={contentColor} weight="bold" />
      ) : null}
      <Text variant="caption" weight="semibold" style={[styles.label, { color: contentColor }]}>
        {label}
      </Text>
    </Pressable>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    minHeight: 44,
    maxWidth: '100%',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.full,
    borderWidth: 1,
  },
  selected: {
    backgroundColor: t.colors.primary.main,
    borderColor: t.colors.primary.main,
  },
  unselected: {
    backgroundColor: t.colors.background.card,
    borderColor: t.colors.border.default,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
}))
