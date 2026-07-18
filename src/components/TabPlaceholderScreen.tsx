import { View } from 'react-native'

import { Text, useTabBarHeight } from '@/components/base'
import { createThemedStyles, useThemedStyles } from '@/theme'

export interface TabPlaceholderScreenProps {
  description: string
}

export const TabPlaceholderScreen = ({ description }: TabPlaceholderScreenProps) => {
  const styles = useThemedStyles(createStyles)
  const tabBarHeight = useTabBarHeight()

  return (
    <View style={[styles.container, { paddingBottom: tabBarHeight }]}>
      <Text variant="body" tone="secondary" style={styles.description}>
        {description}
      </Text>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.spacing['2xl'],
    backgroundColor: t.colors.background.base,
  },
  description: {
    textAlign: 'center',
  },
}))
