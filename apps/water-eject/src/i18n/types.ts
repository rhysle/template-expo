import type en from './locales/en.json'

type TranslationKeys = Omit<typeof en, 'currencies'>

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: TranslationKeys }
    returnNull: false
  }
}
