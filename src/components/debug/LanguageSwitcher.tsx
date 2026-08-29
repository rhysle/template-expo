import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'

import { Card, ChoiceChip, Text } from '@/components/base'
import { getDeviceLanguage, supportedLanguageCodes } from '@/i18n'
import { getDebugLanguageOverride, setDebugLanguageOverride } from '@/storage'
import { createThemedStyles, useThemedStyles } from '@/theme'

const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  ar: 'العربية',
  bn: 'বাংলা',
  ca: 'Català',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  es: 'Español',
  'es-MX': 'Español (México)',
  fi: 'Suomi',
  fr: 'Français',
  'fr-CA': 'Français (Canada)',
  he: 'עברית',
  hi: 'हिन्दी',
  hr: 'Hrvatski',
  hu: 'Magyar',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  ms: 'Bahasa Melayu',
  nb: 'Norsk bokmål',
  nl: 'Nederlands',
  pl: 'Polski',
  pt: 'Português',
  'pt-BR': 'Português (Brasil)',
  ro: 'Română',
  ru: 'Русский',
  sk: 'Slovenčina',
  sv: 'Svenska',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
}

const PRIORITY_LANGUAGES = ['en', 'vi', 'ar', 'he']

const languageCodes = [...supportedLanguageCodes].sort((a, b) => {
  const aPriority = PRIORITY_LANGUAGES.indexOf(a)
  const bPriority = PRIORITY_LANGUAGES.indexOf(b)

  if (aPriority !== -1 || bPriority !== -1) {
    if (aPriority === -1) return 1
    if (bPriority === -1) return -1
    return aPriority - bPriority
  }

  return a.localeCompare(b)
})

const getLanguageLabel = (language: string): string => {
  const name = LANGUAGE_NAMES[language] ?? language
  return `${language} · ${name}`
}

export const LanguageSwitcher = () => {
  const styles = useThemedStyles(createStyles)
  const { i18n } = useTranslation()
  const [languageOverride, setLanguageOverride] = useState(getDebugLanguageOverride)
  const [isChanging, setIsChanging] = useState(false)
  const deviceLanguage = getDeviceLanguage()

  const changeLanguage = async (nextLanguage: string | null) => {
    if (nextLanguage === languageOverride || isChanging) return

    setIsChanging(true)

    try {
      await i18n.changeLanguage(nextLanguage ?? deviceLanguage)
      setDebugLanguageOverride(nextLanguage)
      setLanguageOverride(nextLanguage)
    } catch {
      Alert.alert('Language change failed', 'The selected language could not be applied.')
    } finally {
      setIsChanging(false)
    }
  }

  const activeLanguage = languageOverride ?? deviceLanguage

  return (
    <Card padding="md">
      <Text variant="caption" weight="semibold" tone="muted">
        Active locale
      </Text>
      <Text variant="body" weight="semibold">
        {languageOverride === null
          ? `System · ${deviceLanguage}`
          : getLanguageLabel(activeLanguage)}
      </Text>
      <Text variant="caption" tone="muted" style={styles.description}>
        Changes translations only. Layout direction continues to follow the native app setting.
      </Text>

      <View style={styles.options}>
        <ChoiceChip
          label={`System · ${deviceLanguage}`}
          selected={languageOverride === null}
          disabled={isChanging}
          onPress={() => void changeLanguage(null)}
        />
        {languageCodes.map((language) => (
          <ChoiceChip
            key={language}
            label={getLanguageLabel(language)}
            selected={languageOverride === language}
            disabled={isChanging}
            onPress={() => void changeLanguage(language)}
          />
        ))}
      </View>
    </Card>
  )
}

const createStyles = createThemedStyles((t) => ({
  description: {
    marginTop: t.spacing.xs,
    marginBottom: t.spacing.md,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
}))
