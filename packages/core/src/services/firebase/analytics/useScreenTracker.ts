import { usePathname } from 'expo-router'
import { useEffect } from 'react'

import { trackScreenView } from './analyticsService'

/**
 * Tracks screen views automatically on every Expo Router navigation.
 * Call once inside RootLayoutContent so it has access to the router context.
 */
export const useScreenTracker = () => {
  const pathname = usePathname()

  useEffect(() => {
    trackScreenView(pathname)
  }, [pathname])
}
