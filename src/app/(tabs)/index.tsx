import { View } from 'react-native'

import { Text } from '@/components/base'
import { useCommonStyles } from '@/theme'

export default function HomeScreen() {
  const commonStyles = useCommonStyles()
  return (
    <View style={commonStyles.screen}>
      <Text>Sample Text</Text>
    </View>
  )
}
