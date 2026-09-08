const RTL_LANGUAGES = new Set(['ar', 'he'])

/**
 * Returns true if the given BCP-47 language code is a right-to-left language.
 * Strips region subtags ('ar-SA' → 'ar') before lookup.
 */
export const isRTLLanguage = (lang: string): boolean =>
  RTL_LANGUAGES.has(lang.split('-')[0].toLowerCase())
