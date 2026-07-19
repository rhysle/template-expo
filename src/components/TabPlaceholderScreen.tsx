import { View } from 'react-native'

import { TabScreen, Text } from '@/components/base'
import { createThemedStyles, useThemedStyles } from '@/theme'

export interface TabPlaceholderScreenProps {
  description: string
}

export const TabPlaceholderScreen = ({ description }: TabPlaceholderScreenProps) => {
  const styles = useThemedStyles(createStyles)

  return (
    <TabScreen>
      <View style={styles.container}>
        <Text variant="body" tone="secondary" style={styles.description}>
          {description}
        </Text>
      </View>
    </TabScreen>
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
