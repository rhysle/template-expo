import {
  BottomSheet as ExpoBottomSheet,
  BottomSheetScrollView,
  BottomSheetView,
} from '@expo/ui/community/bottom-sheet'
import type { ReactNode } from 'react'
import { type StyleProp, View, type ViewStyle } from 'react-native'

import { createThemedStyles, useThemedStyles } from '@/theme'

export interface NativeBottomSheetProps {
  visible: boolean
  onDismiss: () => void
  children: ReactNode
  snapPoints?: (number | string)[]
  showDragIndicator?: boolean
  scrollable?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
  scrollHeader?: ReactNode
  scrollFooter?: ReactNode
}

export const NativeBottomSheet = ({
  visible,
  onDismiss,
  children,
  snapPoints,
  showDragIndicator = true,
  scrollable = false,
  contentContainerStyle,
  scrollHeader,
  scrollFooter,
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
      {scrollable && (scrollHeader || scrollFooter) ? (
        <BottomSheetView style={styles.scrollFrame}>
          <BottomSheetScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.scroll}
            contentContainerStyle={contentContainerStyle}>
            {children}
          </BottomSheetScrollView>
          {scrollHeader ? (
            <View pointerEvents="box-none" style={styles.scrollHeader}>
              {scrollHeader}
            </View>
          ) : null}
          {scrollFooter ? (
            <View pointerEvents="box-none" style={styles.scrollFooter}>
              {scrollFooter}
            </View>
          ) : null}
        </BottomSheetView>
      ) : scrollable ? (
        <BottomSheetScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          contentContainerStyle={contentContainerStyle}>
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={contentContainerStyle}>{children}</BottomSheetView>
      )}
    </ExpoBottomSheet>
  )
}

const createStyles = createThemedStyles((t) => ({
  sheet: {
    backgroundColor: t.colors.background.surface,
  },
  scrollFrame: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  scrollHeader: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
  },
  scrollFooter: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
  },
}))
