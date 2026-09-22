import { useSetTabBarHeight } from '@shared/core/components/base'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

interface ProjectBottomActionBarProps {
  center: ReactNode
  leading?: ReactNode
  manageTabBarHeight?: boolean
  onHeightChange?: (height: number) => void
  trailing?: ReactNode
}

/** Shared floating action-bar geometry for Projects and media-detail screens. */
export function ProjectBottomActionBar({
  center,
  leading,
  manageTabBarHeight = true,
  onHeightChange,
  trailing,
}: ProjectBottomActionBarProps) {
  const styles = useThemedStyles(createStyles)
  const { spacing } = useTheme()
  const insets = useSafeAreaInsets()
  const setHeight = useSetTabBarHeight()
  const [measuredHeight, setMeasuredHeight] = useState(0)

  useEffect(() => {
    onHeightChange?.(measuredHeight)
    if (!manageTabBarHeight) return
    setHeight(measuredHeight)
    return () => setHeight(0)
  }, [manageTabBarHeight, measuredHeight, onHeightChange, setHeight])

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: insets.bottom + spacing.sm }]}
      onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}>
      <View pointerEvents="box-none" style={styles.barRow}>
        <View pointerEvents="box-none" style={styles.leadingAction}>
          {leading}
        </View>
        {center}
        <View pointerEvents="box-none" style={styles.trailingAction}>
          {trailing}
        </View>
      </View>
    </View>
  )
}

const createStyles = createThemedStyles((theme) => ({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  barRow: {
    width: '100%',
    minHeight: theme.spacing['5xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingAction: { position: 'absolute', left: 0 },
  trailingAction: { position: 'absolute', right: 0 },
}))
