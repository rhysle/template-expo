import {
  BottomSheet,
  Group,
  Overlay,
  RNHostView,
  ScrollView as NativeScrollView,
} from '@expo/ui/swift-ui'
import {
  interactiveDismissDisabled,
  type ModifierConfig,
  padding,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  presentationSizing,
} from '@expo/ui/swift-ui/modifiers'
import { useImperativeHandle, useRef } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { useTheme } from '@/theme'

import type { NativeBottomSheetMethods, NativeBottomSheetProps } from './NativeBottomSheet.types'
import { NativeUIHost } from './NativeUIHost'

const FITTED_SHEET_MAX_WIDTH = 600

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
  const { width } = useWindowDimensions()
  const closeRequestedRef = useRef(false)
  const fitsContent = preset === 'content'
  const fittedContentWidth = Math.min(width, FITTED_SHEET_MAX_WIDTH)

  useImperativeHandle<NativeBottomSheetMethods, NativeBottomSheetMethods>(ref, () => ({
    close: () => {
      if (!visible) return
      closeRequestedRef.current = true
      onDismiss()
    },
  }))

  const modifiers: ModifierConfig[] = [
    padding({ top: showDragIndicator ? 16 : 0 }),
    presentationDragIndicator(showDragIndicator ? 'visible' : 'hidden'),
    interactiveDismissDisabled(false),
    presentationBackground(colors.background.surface),
  ]

  if (fitsContent) {
    modifiers.push(presentationSizing('fitted'))
  } else {
    modifiers.push(presentationDetents(preset === 'large' ? ['large'] : ['medium', 'large']))
  }

  const naturalContent = (
    <RNHostView matchContents>
      <View style={[{ width: fittedContentWidth }, contentContainerStyle]}>{children}</View>
    </RNHostView>
  )
  const scrollContent = scrollable ? (
    <NativeScrollView showsIndicators>{naturalContent}</NativeScrollView>
  ) : null
  const scrollContentWithHeader =
    scrollContent && scrollHeader ? (
      <Overlay alignment="top">
        {scrollContent}
        <Overlay.Content>
          <RNHostView matchContents>
            <View style={{ width: fittedContentWidth }}>{scrollHeader}</View>
          </RNHostView>
        </Overlay.Content>
      </Overlay>
    ) : (
      scrollContent
    )
  const content = scrollContentWithHeader ? (
    scrollFooter ? (
      <Overlay alignment="bottom">
        {scrollContentWithHeader}
        <Overlay.Content>
          <RNHostView matchContents>
            <View style={{ width: fittedContentWidth }}>{scrollFooter}</View>
          </RNHostView>
        </Overlay.Content>
      </Overlay>
    ) : (
      scrollContentWithHeader
    )
  ) : (
    <View style={[fitsContent && { width: fittedContentWidth }, contentContainerStyle]}>
      {children}
    </View>
  )

  return (
    <NativeUIHost matchContents={false} style={{ position: 'absolute', width }}>
      <BottomSheet
        isPresented={visible}
        fitToContents={fitsContent}
        onIsPresentedChange={() => {}}
        onDismiss={() => {
          if (closeRequestedRef.current) {
            closeRequestedRef.current = false
            return
          }
          onDismiss()
        }}>
        <Group modifiers={modifiers}>
          {scrollable ? content : <RNHostView matchContents={fitsContent}>{content}</RNHostView>}
        </Group>
      </BottomSheet>
    </NativeUIHost>
  )
}
