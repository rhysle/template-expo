import { getLocales } from 'expo-localization'
import { useEffect } from 'react'
import { AppState, I18nManager, Platform } from 'react-native'

import { reloadApp } from '@/services/otaUpdate'

import { isRTLLanguage } from './rtlService'

/**
 * Syncs React Native's RTL layout direction with the current per-app locale on Android.
 *
 * Two scenarios handled (Android-only; iOS restarts automatically):
 *
 * 1. Cold start / RTL mismatch - I18nManager.isRTL was frozen at process start from the
 *    system language. If the per-app locale disagrees, forceRTL + reload immediately.
 *    The AppState listener is not registered in this path.
 *
 * 2. Per-app language changed while backgrounded - AppState listener fires when the app
 *    returns to the foreground. If the locale differs from the one recorded at mount,
 *    RTL direction is updated if necessary and the app reloads once. The `reloading`
 *    flag prevents a second reload before the JS bundle tears down.
 *
 * Both paths are self-terminating: after the reload the stored locale matches the current
 * one, so neither condition fires again.
 */
export const useRTLSync = (): void => {
  useEffect(() => {
    if (Platform.OS !== 'android') return

    const initialLocale = getLocales()[0]?.languageTag ?? 'en'
    const shouldBeRTL = isRTLLanguage(initialLocale)

    // Path 1: RTL mismatch on startup - fix and reload; skip registering AppState listener.
    if (shouldBeRTL !== I18nManager.isRTL) {
      I18nManager.forceRTL(shouldBeRTL)
      void reloadApp()
      return
    }

    // Path 2: Detect per-app language change while the app was backgrounded.
    let reloading = false

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || reloading) return

      const locale = getLocales()[0]?.languageTag ?? 'en'
      if (locale === initialLocale) return

      reloading = true
      const newShouldBeRTL = isRTLLanguage(locale)
      if (newShouldBeRTL !== I18nManager.isRTL) {
        I18nManager.forceRTL(newShouldBeRTL)
      }
      void reloadApp()
    })

    return () => subscription.remove()
  }, [])
}
