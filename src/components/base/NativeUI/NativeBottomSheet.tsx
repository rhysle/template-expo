import { BottomSheet as ExpoBottomSheet } from '@expo/ui/community/bottom-sheet'
import type { ReactNode } from 'react'

import { createThemedStyles, useThemedStyles } from '@/theme'

export interface NativeBottomSheetProps {
  visible: boolean
  onDismiss: () => void
  children: ReactNode
  snapPoints?: (number | string)[]
  showDragIndicator?: boolean
}

export const NativeBottomSheet = ({
  visible,
  onDismiss,
  children,
  snapPoints,
  showDragIndicator = true,
}: NativeBottomSheetProps) => {
  const styles = useThemedStyles(createStyles)

  return (
    <ExpoBottomSheet
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints?.length}
      enablePanDownToClose
      handleComponent={showDragIndicator ? undefined : null}
      backgroundStyle={styles.sheet}
      onDismiss={onDismiss}>
      {children}
    </ExpoBottomSheet>
  )
}

const createStyles = createThemedStyles((t) => ({
  sheet: {
    backgroundColor: t.colors.background.surface,
  },
}))
