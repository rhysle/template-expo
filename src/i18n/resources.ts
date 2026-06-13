import en from './locales/en.json'

const localeContext = require.context('./locales', false, /\.json$/)

const dynamicResources = Object.fromEntries(
  localeContext.keys().map((key) => {
    const lang = key.replace('./', '').replace('.json', '')
    return [lang, { translation: localeContext(key) }]
  })
)

export const resources = {
  en: { translation: en },
  ...dynamicResources,
} satisfies Record<string, { translation: Record<string, unknown> }>
