import { View } from 'react-native'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { Text } from '../Text'
import type { ListItemInfoProps } from './types'

export const ListItemInfo = ({ icon: Icon, title, subtitle }: ListItemInfoProps) => {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      <Icon size={iconSizes.md} color={colors.text.secondary} />
      <View style={styles.textStack}>
        <Text variant="subtitle" weight="medium">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textStack: {
    flex: 1,
    marginLeft: t.spacing.xl,
    gap: t.spacing.xs,
  },
}))
