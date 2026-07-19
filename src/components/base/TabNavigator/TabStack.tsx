import { Stack } from 'expo-router/stack'
import type { ReactNode } from 'react'

import { useTheme } from '@/theme'

export interface TabStackProps {
  headerRight?: () => ReactNode
  title: string
}

export const TabStack = ({ headerRight, title }: TabStackProps) => {
  const { colors, typography } = useTheme()

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background.base },
        headerRight,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background.base },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          color: colors.text.primary,
          fontFamily: typography.fontFamily.semibold,
          fontWeight: typography.weights.semibold,
        },
      }}>
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  )
}
