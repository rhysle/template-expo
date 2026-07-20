import { Host } from '@expo/ui'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { useIsRTL } from '@/services/rtl'
import { useTheme } from '@/theme'

export interface NativeUIHostProps {
  children: ReactNode
  matchContents?: boolean | { horizontal?: boolean; vertical?: boolean }
  style?: StyleProp<ViewStyle>
}

export const NativeUIHost = ({ children, matchContents = true, style }: NativeUIHostProps) => {
  const { appearance, colors } = useTheme()
  const isRTL = useIsRTL()

  return (
    <Host
      matchContents={matchContents}
      colorScheme={appearance}
      seedColor={colors.primary.main}
      layoutDirection={isRTL ? 'rightToLeft' : 'leftToRight'}
      ignoreSafeArea="all"
      style={style}>
      {children}
    </Host>
  )
}
