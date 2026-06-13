import { I18nManager } from 'react-native'

/**
 * Returns whether the app is currently running in RTL mode.
 * Value is set by the OS at app startup based on device language and
 * the supportsRTL native flag - static for the entire app session.
 * Use for components that can't be handled by automatic layout mirroring
 * (e.g. custom Skia animations with hardcoded LTR coordinates).
 */
export const useIsRTL = (): boolean => I18nManager.isRTL
