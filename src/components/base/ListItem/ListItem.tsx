import type { ReactNode } from 'react'
import { type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native'

import { createThemedStyles, useThemedStyles } from '@/theme'

import { Pressable, type PressableProps } from '../Pressable'

export interface ListItemProps extends Omit<ViewProps, 'style'> {
  left?: ReactNode
  right?: ReactNode
  children?: ReactNode
  withDivider?: boolean
  style?: StyleProp<ViewStyle>
  onPress?: PressableProps['onPress']
  haptic?: boolean
}

export const ListItem = ({
  left,
  right,
  children,
  withDivider,
  style,
  onPress,
  haptic,
  ...props
}: ListItemProps) => {
  const styles = useThemedStyles(createStyles)

  const content = (
    <>
      {left ?? children}
      {right ? <View style={styles.right}>{right}</View> : null}
    </>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        haptic={haptic}
        variant="default"
        style={[styles.row, withDivider && styles.divider, style]}
        {...props}>
        {content}
      </Pressable>
    )
  }

  return (
    <View style={[styles.row, withDivider && styles.divider, style]} {...props}>
      {content}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.spacing.xl,
    paddingHorizontal: t.spacing.xl,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: t.colors.background.surface,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    marginStart: t.spacing.md,
  },
}))
