import type { SnackbarState } from '@shared/core/stores/features/snackbar'
import { useSnackbarState } from '@shared/core/stores/features/snackbar'
import { useTheme } from '@shared/core/theme'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated'
import { FullWindowOverlay } from 'react-native-screens'
import { scheduleOnRN } from 'react-native-worklets'

import { Snackbar } from './Snackbar'

const APPEAR_CONFIG = { duration: 220, easing: Easing.out(Easing.ease) }
const DISMISS_CONFIG = { duration: 160, easing: Easing.in(Easing.quad) }

export const SnackbarHost = () => {
  const { snackbar, hideSnackbar } = useSnackbarState()
  const progress = useSharedValue(0)
  // Holds the last non-null snackbar so content stays visible during the exit animation.
  // Using useState (not useRef) so React re-renders synchronously with the correct
  // content on the very first render a snackbar appears. Updating it during render
  // (derived-state pattern) avoids the blank-content flash that useRef + useEffect causes:
  // useEffect runs after render, so the first paint would always show an empty title.
  const [lastSnackbar, setLastSnackbar] = useState<SnackbarState | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { spacing } = useTheme()

  // Update synchronously during render when a new snackbar arrives.
  // React re-renders immediately before painting when setState is called during render.
  // The condition prevents an infinite loop - on the re-render snackbar === lastSnackbar.
  if (snackbar !== null && snackbar !== lastSnackbar) {
    setLastSnackbar(snackbar)
  }

  const triggerDismiss = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    progress.value = withTiming(0, DISMISS_CONFIG, (finished) => {
      // scheduleOnRN is the react-native-worklets replacement for deprecated runOnJS.
      // Dispatches a JS-thread call from within this UI-thread worklet callback.
      if (finished) scheduleOnRN(hideSnackbar)
    })
  }, [hideSnackbar, progress])

  useEffect(() => {
    if (!snackbar) return

    // Cancel any in-flight dismiss and immediately begin appearing.
    cancelAnimation(progress)
    progress.value = withTiming(1, APPEAR_CONFIG)

    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = null

    // durationMs <= 0 means "persist until user dismisses manually".
    if (snackbar.durationMs <= 0) return

    hideTimeoutRef.current = setTimeout(triggerDismiss, snackbar.durationMs)

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [snackbar, progress, triggerDismiss])

  const handleAction = useCallback(() => {
    if (!lastSnackbar?.action) return
    try {
      lastSnackbar.action.onPress()
    } finally {
      triggerDismiss()
    }
  }, [lastSnackbar, triggerDismiss])

  const content = (
    // pointerEvents: snackbar is non-null while visible and mid-dismiss (hideSnackbar
    // only fires after animation ends). It becomes null after animation completes -
    // exactly when we want 'none' to prevent tapping invisible buttons.
    <View pointerEvents={snackbar !== null ? 'box-none' : 'none'} style={StyleSheet.absoluteFill}>
      <Snackbar
        progress={progress}
        title={lastSnackbar?.title ?? ''}
        subtitle={lastSnackbar?.subtitle}
        variant={lastSnackbar?.variant ?? 'default'}
        icon={lastSnackbar?.icon}
        action={lastSnackbar?.action}
        onAction={handleAction}
        onDismiss={triggerDismiss}
        bottomOffset={spacing.lg}
        showAccent={lastSnackbar?.showAccent ?? false}
        showShadow={lastSnackbar?.showShadow ?? true}
        blur={lastSnackbar?.blur ?? true}
        blurIntensity={lastSnackbar?.blurIntensity ?? 60}
      />
    </View>
  )

  // A native-stack full-screen modal is hosted above the root React view on iOS,
  // so zIndex alone cannot place the snackbar over it. FullWindowOverlay attaches
  // this non-modal notification layer directly to the active UIWindow.
  return Platform.OS === 'ios' && snackbar !== null ? (
    <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}>
      {content}
    </FullWindowOverlay>
  ) : (
    content
  )
}
