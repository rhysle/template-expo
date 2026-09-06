import { ModalBottomSheet, type ModalBottomSheetRef, RNHostView } from '@expo/ui/jetpack-compose'
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'

import { useIsRTL } from '@/services/rtl'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import type { NativeBottomSheetMethods, NativeBottomSheetProps } from './NativeBottomSheet.types'
import { NativeUIHost } from './NativeUIHost'

// Keep fit-to-content React Native views inside Material 3's default large-screen sheet width.
const MATERIAL3_MODAL_BOTTOM_SHEET_MAX_WIDTH = 640

export const NativeBottomSheet = ({
  ref,
  visible,
  onDismiss,
  children,
  preset = 'content',
  showDragIndicator = true,
  scrollable = false,
  contentContainerStyle,
  scrollHeader,
  scrollFooter,
}: NativeBottomSheetProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const isRTL = useIsRTL()
  const { width } = useWindowDimensions()
  const sheetRef = useRef<ModalBottomSheetRef>(null)
  const closedRef = useRef(!visible)
  const [isMounted, setIsMounted] = useState(visible)
  const fitsContent = preset === 'content'
  const isResizable = preset === 'resizable'
  const fitContentWidth = Math.min(width, MATERIAL3_MODAL_BOTTOM_SHEET_MAX_WIDTH)

  const finishDismiss = useCallback(() => {
    setIsMounted(false)
    if (closedRef.current) return
    closedRef.current = true
    onDismiss()
  }, [onDismiss])

  const hide = useCallback(() => {
    const hidePromise = sheetRef.current?.hide()
    if (!hidePromise) {
      finishDismiss()
      return
    }
    void hidePromise.then(finishDismiss)
  }, [finishDismiss])

  useImperativeHandle<NativeBottomSheetMethods, NativeBottomSheetMethods>(ref, () => ({
    close: hide,
  }))

  useEffect(() => {
    if (visible) {
      closedRef.current = false
      setIsMounted(true)
      return
    }

    if (isMounted) hide()
  }, [visible, isMounted, hide])

  if (!isMounted) return null

  const content = scrollable ? (
    <View style={styles.scrollFrame}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={styles.scroll}
        contentContainerStyle={contentContainerStyle}>
        {children}
      </ScrollView>
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
    </View>
  ) : (
    <View style={contentContainerStyle}>{children}</View>
  )

  return (
    <NativeUIHost matchContents={false} style={{ position: 'absolute', width }}>
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={finishDismiss}
        skipPartiallyExpanded={!isResizable}
        initialFullyExpanded={preset === 'large'}
        showDragHandle={showDragIndicator}
        sheetGesturesEnabled
        containerColor={colors.background.surface}
        properties={{ shouldDismissOnBackPress: true, shouldDismissOnClickOutside: true }}>
        <RNHostView matchContents={fitsContent}>
          <View
            style={
              fitsContent
                ? { alignSelf: isRTL ? 'flex-end' : 'flex-start', width: fitContentWidth }
                : styles.fillFrame
            }>
            {content}
          </View>
        </RNHostView>
      </ModalBottomSheet>
    </NativeUIHost>
  )
}

const createStyles = createThemedStyles(() => ({
  fillFrame: {
    flexGrow: 1,
    height: 0,
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
