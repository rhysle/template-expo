import type { Icon } from 'phosphor-react-native'
import { View } from 'react-native'

import { Text } from '@/components/base'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

interface OnboardingScreenContentProps {
  icon: Icon
  title: string
  description: string
}

export const OnboardingScreenContent = ({
  icon: Icon,
  title,
  description,
}: OnboardingScreenContentProps) => {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon size={iconSizes.hero} color={colors.primary.main} />
      </View>
      <Text variant="title" weight="bold" align="center">
        {title}
      </Text>
      <Text variant="subtitle" tone="secondary" align="center" style={styles.description}>
        {description}
      </Text>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing['3xl'],
    gap: t.spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    lineHeight: 24,
  },
}))
