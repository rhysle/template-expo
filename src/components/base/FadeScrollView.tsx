import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ScrollView, type ScrollViewProps, View } from 'react-native'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

const DEFAULT_BOTTOM_THRESHOLD = 8

export interface FadeScrollViewProps extends ScrollViewProps {
  children?: ReactNode
  fadeHeight?: number
  bottomThreshold?: number
}

const toTransparentColor = (color: string) => {
  const normalizedColor = color.trim()

  if (!normalizedColor.startsWith('#')) {
    return 'transparent'
  }

  const hex = normalizedColor.slice(1)

  if (hex.length === 3) {
    const [r, g, b] = hex
    return `rgba(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}, 0)`
  }

  if (hex.length === 6) {
    return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, 0)`
  }

  return 'transparent'
}

export const FadeScrollView = ({
  children,
  fadeHeight,
  bottomThreshold = DEFAULT_BOTTOM_THRESHOLD,
  onLayout,
  onContentSizeChange,
  onScroll,
  scrollEventThrottle = 16,
  showsVerticalScrollIndicator = false,
  ...props
}: FadeScrollViewProps) => {
  const styles = useThemedStyles(createStyles)
  const { colors, spacing } = useTheme()
  const [scrollOffsetY, setScrollOffsetY] = useState(0)
  const [scrollContentHeight, setScrollContentHeight] = useState(0)
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0)

  const maxScrollOffsetY = Math.max(scrollContentHeight - scrollViewportHeight, 0)
  const hasOverflow = maxScrollOffsetY > 1
  const isAtBottom = scrollOffsetY + scrollViewportHeight >= scrollContentHeight - bottomThreshold
  const isOverscrolling = scrollOffsetY < 0 || scrollOffsetY > maxScrollOffsetY
  const showBottomFade = hasOverflow ? !isAtBottom : isOverscrolling
  const resolvedFadeHeight = fadeHeight ?? spacing['4xl']
  const gradientColors = [
    toTransparentColor(colors.background.base),
    colors.background.base,
  ] as const

  return (
    <View style={styles.container}>
      <ScrollView
        {...props}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        scrollEventThrottle={scrollEventThrottle}
        onLayout={(event) => {
          setScrollViewportHeight(event.nativeEvent.layout.height)
          onLayout?.(event)
        }}
        onContentSizeChange={(width, height) => {
          setScrollContentHeight(height)
          onContentSizeChange?.(width, height)
        }}
        onScroll={(event) => {
          setScrollOffsetY(event.nativeEvent.contentOffset.y)
          onScroll?.(event)
        }}>
        {children}
      </ScrollView>

      {showBottomFade ? (
        <LinearGradient
          pointerEvents="none"
          colors={gradientColors}
          style={[styles.bottomFadeOverlay, { height: resolvedFadeHeight }]}
        />
      ) : null}
    </View>
  )
}

const createStyles = createThemedStyles(() => ({
  container: {
    flex: 1,
    position: 'relative',
  },
  bottomFadeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
}))
