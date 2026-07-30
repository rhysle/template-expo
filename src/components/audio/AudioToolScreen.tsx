import type { PropsWithChildren } from 'react'
import { type StyleProp, View, type ViewStyle } from 'react-native'

import { TabScreen, useTabBarContentInset } from '@/components/base'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

interface AudioToolScreenProps extends PropsWithChildren {
  contentStyle?: StyleProp<ViewStyle>
  variant?: 'default' | 'focused'
}

export const AudioToolScreen = ({
  children,
  contentStyle,
  variant = 'default',
}: AudioToolScreenProps) => {
  const bottomInset = useTabBarContentInset()
  const { spacing } = useTheme()
  const styles = useThemedStyles(createStyles)
  const isFocused = variant === 'focused'

  return (
    <TabScreen contentUnderTabBar={!isFocused}>
      <View
        style={[
          styles.container,
          isFocused && styles.focusedContainer,
          { paddingBottom: isFocused ? spacing.lg : spacing['4xl'] + bottomInset },
        ]}>
        <View style={[styles.content, isFocused && styles.focusedContent, contentStyle]}>
          {children}
        </View>
      </View>
    </TabScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.lg,
  },
  focusedContainer: {
    paddingTop: t.spacing.md,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: t.spacing.xl,
  },
  focusedContent: {
    flex: 1,
    minHeight: 0,
    gap: t.spacing.lg,
  },
}))
