import type { Locale } from 'date-fns'
import { de, enUS, es, fr, hi, id, it, ja, ko, ptBR, ru, tr, vi, zhCN, zhTW } from 'date-fns/locale'

const dateFnsLocales: Record<string, Locale> = {
  en: enUS,
  vi,
  ja,
  ko,
  'zh-Hans': zhCN,
  'zh-Hant': zhTW,
  de,
  fr,
  es,
  'pt-BR': ptBR,
  hi,
  it,
  id,
  ru,
  tr,
}

/**
 * Returns the date-fns `Locale` object for the given BCP-47 language tag.
 * Tries the full tag first (e.g. "zh-Hans-CN"), then progressively strips
 * subtags ("zh-Hans", "zh") before falling back to enUS.
 */
export const getDateFnsLocale = (language: string): Locale => {
  const parts = language.split('-')
  for (let i = parts.length; i > 0; i--) {
    const tag = parts.slice(0, i).join('-')
    if (dateFnsLocales[tag]) return dateFnsLocales[tag]
  }
  return enUS
}
