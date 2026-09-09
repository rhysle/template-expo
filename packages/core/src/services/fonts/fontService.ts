import { useCoreRuntime } from '@shared/core/runtime'
import type { FontFamilyMap } from '@shared/core/runtime/fonts'
import { useFonts } from 'expo-font'

function getDevFontMap(runtimeFontFamilyMap: FontFamilyMap): Record<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const devFonts = require('@expo-google-fonts/dev')
  const fontMap: Record<string, string> = {}
  for (const fontName of Object.values(runtimeFontFamilyMap)) {
    const url = devFonts[fontName]
    if (url) {
      fontMap[fontName] = url
    }
  }
  return fontMap
}

// Dev: Google Font URLs from @expo-google-fonts/dev (loaded over the network)
// Prod: empty map - fonts are natively embedded via expo-font config plugin; no JS loading needed

/**
 * Loads fonts for the app.
 * - Dev: fetches Google Fonts over the network via @expo-google-fonts/dev URLs
 * - Prod: no-op (fonts are natively embedded via expo-font config plugin + prebuild)
 */
export function useLoadFonts(): { fontsLoaded: boolean; fontError: Error | null } {
  const { fonts } = useCoreRuntime()
  const [loaded, error] = useFonts(__DEV__ ? getDevFontMap(fonts.runtimeFontFamilyMap) : {})
  return { fontsLoaded: loaded, fontError: error }
}
