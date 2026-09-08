import type { ReactNode } from 'react'
import { View, type ViewProps } from 'react-native'

import { createThemedStyles, useThemedStyles } from '@/theme'

import { Text } from './base'

export interface ScreenHeaderProps extends ViewProps {
  title: string
  subtitle?: string
  right?: ReactNode
}

export const ScreenHeader = ({ title, subtitle, right, style, ...props }: ScreenHeaderProps) => {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={[styles.header, style]} {...props}>
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text variant="title" weight="bold">
            {title}
          </Text>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? (
        <Text variant="subtitle" tone="secondary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  header: {
    marginBottom: t.spacing.xl,
    gap: t.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleCol: {
    flex: 1,
    marginEnd: t.spacing.md,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
}))
