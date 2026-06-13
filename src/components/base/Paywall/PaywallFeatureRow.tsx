import { View } from 'react-native'

import { Text } from '@/components/base/Text'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import type { PaywallFeatureItem } from './types'

interface PaywallFeatureRowProps {
  feature: PaywallFeatureItem
}

export const PaywallFeatureRow = ({ feature }: PaywallFeatureRowProps) => {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const IconComponent = feature.icon

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <IconComponent size={iconSizes.lg} color={colors.primary.main} />
      </View>
      <View style={styles.textContainer}>
        <Text variant="body" weight="semibold">
          {feature.title}
        </Text>
        {feature.description ? (
          <Text variant="caption" tone="secondary">
            {feature.description}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: t.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    gap: t.spacing.xs,
  },
}))
