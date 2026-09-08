import type { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'

import { TabBarBanner } from './TabBarBanner'

export const TabNavigatorFrame = ({ children }: PropsWithChildren) => (
  <View collapsable={false} style={styles.container}>
    {children}
    <TabBarBanner />
  </View>
)

const styles = StyleSheet.create({
  container: { flex: 1 },
})
