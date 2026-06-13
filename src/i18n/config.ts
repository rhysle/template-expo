import { getLocales } from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { resources } from './resources'

const getDeviceLanguage = (): string => {
  const locales = getLocales()
  return locales[0]?.languageTag ?? 'en'
}

export const initI18n = () => {
  // eslint-disable-next-line import/no-named-as-default-member
  void i18n.use(initReactI18next).init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: {
      no: ['nb', 'en'],
      default: ['en'],
    },
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  })

  i18n.services.formatter?.add('currency', (value, lng, options) => {
    return new Intl.NumberFormat(lng ?? 'en', {
      style: 'currency',
      currency: options?.currency ?? 'USD',
    }).format(value as number)
  })

  i18n.services.formatter?.add('number', (value, lng) => {
    return new Intl.NumberFormat(lng ?? 'en').format(value as number)
  })

  return i18n
}
