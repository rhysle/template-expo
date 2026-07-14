import { View } from 'react-native'

import { Text } from '@/components/base'
import { createThemedStyles, useThemedStyles } from '@/theme'

export default function HomeScreen() {
  const styles = useThemedStyles(createStyles)
  return (
    <View style={styles.container}>
      <Text>Sample Text</Text>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing.lg,
    backgroundColor: t.colors.background.base,
  },
}))
