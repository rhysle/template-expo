import type { PropsWithChildren, ReactNode } from 'react'
import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native'

import { TabScreen, useTabBarContentInset } from '@/components/base'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

interface AudioToolScreenProps extends PropsWithChildren {
  contentStyle?: StyleProp<ViewStyle>
  footer?: ReactNode
  variant?: 'default' | 'focused'
}

export const AudioToolScreen = ({
  children,
  contentStyle,
  footer,
  variant = 'default',
}: AudioToolScreenProps) => {
  const bottomInset = useTabBarContentInset()
  const { spacing } = useTheme()
  const styles = useThemedStyles(createStyles)
  const isFocused = variant === 'focused'

  return (
    <TabScreen contentUnderTabBar={!isFocused}>
      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.scrollContent,
            isFocused && styles.focusedScrollContent,
            { paddingBottom: isFocused ? spacing.lg : spacing['4xl'] + bottomInset },
          ]}
          scrollIndicatorInsets={isFocused ? undefined : { bottom: bottomInset }}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.content, isFocused && styles.focusedContent, contentStyle]}>
            {children}
          </View>
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </TabScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.lg,
  },
  focusedScrollContent: {
    paddingTop: t.spacing.md,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: t.spacing.xl,
  },
  focusedContent: {
    flexGrow: 1,
    gap: t.spacing.lg,
  },
  footer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.md,
  },
}))
