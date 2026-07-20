import type { Icon } from 'phosphor-react-native'
import { CheckCircleIcon, InfoIcon, WarningCircleIcon, XCircleIcon } from 'phosphor-react-native'
import type { ReactNode } from 'react'
import { type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { type ComponentTone, getComponentToneColor, getComponentToneSurface } from './ComponentTone'
import { Pressable } from './Pressable'
import { Text } from './Text'

export interface InlineNoticeAction {
  label: string
  onPress: () => void
  accessibilityLabel?: string
}

export interface InlineNoticeProps extends Omit<ViewProps, 'children' | 'style'> {
  children: ReactNode
  title?: string
  tone?: ComponentTone
  icon?: Icon | null
  compact?: boolean
  action?: InlineNoticeAction
  style?: StyleProp<ViewStyle>
}

const DEFAULT_ICONS: Record<ComponentTone, Icon> = {
  neutral: InfoIcon,
  accent: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningCircleIcon,
  error: XCircleIcon,
  info: InfoIcon,
}

export const InlineNotice = ({
  children,
  title,
  tone = 'neutral',
  icon,
  compact = false,
  action,
  style,
  ...props
}: InlineNoticeProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const toneColor = getComponentToneColor(colors, tone)
  const surfaceColor = getComponentToneSurface(colors, tone)
  const ResolvedIcon = icon === null ? null : (icon ?? DEFAULT_ICONS[tone])
  const isSimpleContent = typeof children === 'string' || typeof children === 'number'

  return (
    <View
      style={[
        styles.container,
        compact ? styles.compact : styles.regular,
        { backgroundColor: surfaceColor, borderColor: toneColor },
        style,
      ]}
      {...props}>
      {ResolvedIcon ? (
        <View style={[styles.iconContainer, { backgroundColor: colors.background.surface }]}>
          <ResolvedIcon size={iconSizes.md} color={toneColor} weight="bold" />
        </View>
      ) : null}

      <View style={styles.content}>
        {title ? (
          <Text variant="body" weight="semibold">
            {title}
          </Text>
        ) : null}

        {isSimpleContent ? (
          <Text variant="body" tone="secondary" selectable>
            {children}
          </Text>
        ) : (
          children
        )}

        {action ? (
          <Pressable
            accessibilityLabel={action.accessibilityLabel ?? action.label}
            accessibilityRole="button"
            haptic
            onPress={action.onPress}
            style={styles.action}>
            <Text variant="body" weight="semibold" tone="accent">
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.lg,
    borderWidth: 1,
  },
  compact: {
    padding: t.spacing.md,
  },
  regular: {
    padding: t.spacing.lg,
  },
  iconContainer: {
    width: 32,
    height: 32,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
  },
  content: {
    minWidth: 0,
    flex: 1,
    gap: t.spacing.xs,
  },
  action: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
    marginStart: -t.spacing.sm,
  },
}))
