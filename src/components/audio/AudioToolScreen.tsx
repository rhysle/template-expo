import type { PropsWithChildren } from 'react'
import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native'

import { TabScreen, useTabBarContentInset } from '@/components/base'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

interface AudioToolScreenProps extends PropsWithChildren {
  contentStyle?: StyleProp<ViewStyle>
}

export const AudioToolScreen = ({ children, contentStyle }: AudioToolScreenProps) => {
  const bottomInset = useTabBarContentInset()
  const { spacing } = useTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <TabScreen contentUnderTabBar>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.scrollContent,
          contentStyle,
          { paddingBottom: spacing['4xl'] + bottomInset },
        ]}
        scrollIndicatorInsets={{ bottom: bottomInset }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </TabScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: t.spacing.xl,
  },
}))
