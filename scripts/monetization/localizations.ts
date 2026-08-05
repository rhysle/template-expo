import fs from 'node:fs'
import path from 'node:path'

import type {
  MonetizationConfig,
  ProductKey,
  ProductStoreLocalization,
  StoreLocalization,
} from './types'

const ROOT = path.resolve(__dirname, '../..')

const STORE_LOCALES: Record<string, { apple: string; google: string }> = {
  ar: { apple: 'ar-SA', google: 'ar' },
  bn: { apple: 'bn-BD', google: 'bn-BD' },
  cs: { apple: 'cs', google: 'cs-CZ' },
  da: { apple: 'da', google: 'da-DK' },
  de: { apple: 'de-DE', google: 'de-DE' },
  el: { apple: 'el', google: 'el-GR' },
  en: { apple: 'en-US', google: 'en-US' },
  es: { apple: 'es-ES', google: 'es-ES' },
  fi: { apple: 'fi', google: 'fi-FI' },
  fr: { apple: 'fr-FR', google: 'fr-FR' },
  he: { apple: 'he', google: 'iw-IL' },
  hi: { apple: 'hi', google: 'hi-IN' },
  hr: { apple: 'hr', google: 'hr' },
  hu: { apple: 'hu', google: 'hu-HU' },
  id: { apple: 'id', google: 'id' },
  it: { apple: 'it', google: 'it-IT' },
  ja: { apple: 'ja', google: 'ja-JP' },
  ko: { apple: 'ko', google: 'ko-KR' },
  ms: { apple: 'ms', google: 'ms' },
  nb: { apple: 'no', google: 'no-NO' },
  nl: { apple: 'nl-NL', google: 'nl-NL' },
  pl: { apple: 'pl', google: 'pl-PL' },
  'pt-BR': { apple: 'pt-BR', google: 'pt-BR' },
  pt: { apple: 'pt-PT', google: 'pt-PT' },
  ro: { apple: 'ro', google: 'ro' },
  ru: { apple: 'ru', google: 'ru-RU' },
  sv: { apple: 'sv', google: 'sv-SE' },
  th: { apple: 'th', google: 'th' },
  tr: { apple: 'tr', google: 'tr-TR' },
  uk: { apple: 'uk', google: 'uk' },
  vi: { apple: 'vi', google: 'vi' },
  'zh-Hans': { apple: 'zh-Hans', google: 'zh-CN' },
  'zh-Hant': { apple: 'zh-Hant', google: 'zh-TW' },
}

interface PaywallLocaleResource {
  paywall?: {
    title?: unknown
    period?: Record<string, unknown>
    packageTitle?: Record<string, unknown>
    features?: Record<string, { title?: unknown }>
  }
}

const characterCount = (value: string): number => Array.from(value).length

const requiredString = (value: unknown, location: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing localized string ${location}`)
  }
  return value.trim()
}

const withinLimit = (preferred: string, fallback: string, limit: number): string =>
  characterCount(preferred) <= limit ? preferred : fallback

const localizedProduct = (
  premiumName: string,
  packageTitle: string,
  period: string
): ProductStoreLocalization => ({
  displayName: withinLimit(`${premiumName} · ${packageTitle}`, packageTitle, 30),
  description: withinLimit(`${premiumName} · ${period}`, period, 45),
})

const loadResource = (filePath: string): PaywallLocaleResource => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PaywallLocaleResource
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to read monetization localization source ${filePath}: ${message}`)
  }
}

const buildDerivedLocalization = (
  config: MonetizationConfig,
  sourceLocale: string,
  storeLocales: { apple: string; google: string },
  resource: PaywallLocaleResource
): StoreLocalization => {
  const paywall = resource.paywall
  const premiumName = config.google.subscriptionTitle
  const title = requiredString(paywall?.title, `${sourceLocale}.paywall.title`)
  const packageTitle = paywall?.packageTitle
  const period = paywall?.period

  const packageTitles: Record<ProductKey, string> = {
    weekly: requiredString(packageTitle?.week, `${sourceLocale}.paywall.packageTitle.week`),
    monthly: requiredString(packageTitle?.month, `${sourceLocale}.paywall.packageTitle.month`),
    yearly: requiredString(packageTitle?.year, `${sourceLocale}.paywall.packageTitle.year`),
    lifetime: requiredString(
      packageTitle?.lifetime,
      `${sourceLocale}.paywall.packageTitle.lifetime`
    ),
  }
  const periods: Record<ProductKey, string> = {
    weekly: requiredString(period?.week, `${sourceLocale}.paywall.period.week`),
    monthly: requiredString(period?.month, `${sourceLocale}.paywall.period.month`),
    yearly: requiredString(period?.year, `${sourceLocale}.paywall.period.year`),
    lifetime: requiredString(period?.lifetime, `${sourceLocale}.paywall.period.lifetime`),
  }
  const benefits = Object.values(paywall?.features ?? {})
    .map((feature) => (typeof feature.title === 'string' ? feature.title.trim() : ''))
    .filter((benefit) => benefit.length > 0 && characterCount(benefit) <= 40)
    .slice(0, 4)

  return {
    sourceLocale,
    appleLocale: storeLocales.apple,
    googleLocale: storeLocales.google,
    subscriptionGroupDisplayName: premiumName,
    subscriptionTitle: premiumName,
    subscriptionDescription: withinLimit(title, premiumName, 80),
    subscriptionBenefits: benefits,
    products: {
      weekly: localizedProduct(premiumName, packageTitles.weekly, periods.weekly),
      monthly: localizedProduct(premiumName, packageTitles.monthly, periods.monthly),
      yearly: localizedProduct(premiumName, packageTitles.yearly, periods.yearly),
      lifetime: localizedProduct(premiumName, packageTitles.lifetime, periods.lifetime),
    },
  }
}

const buildSourceLocalization = (
  config: MonetizationConfig,
  sourceLocale: string
): StoreLocalization => ({
  sourceLocale,
  appleLocale: config.apple.locale,
  googleLocale: config.google.locale,
  subscriptionGroupDisplayName: config.apple.subscriptionGroupDisplayName,
  subscriptionTitle: config.google.subscriptionTitle,
  subscriptionDescription: config.google.subscriptionDescription,
  subscriptionBenefits: [...config.google.subscriptionBenefits],
  products: {
    weekly: {
      displayName: config.products.weekly.displayName,
      description: config.products.weekly.description,
    },
    monthly: {
      displayName: config.products.monthly.displayName,
      description: config.products.monthly.description,
    },
    yearly: {
      displayName: config.products.yearly.displayName,
      description: config.products.yearly.description,
    },
    lifetime: {
      displayName: config.products.lifetime.displayName,
      description: config.products.lifetime.description,
    },
  },
})

let cachedConfig: MonetizationConfig | undefined
let cachedLocalizations: StoreLocalization[] | undefined

export const loadStoreLocalizations = (config: MonetizationConfig): StoreLocalization[] => {
  if (cachedConfig === config && cachedLocalizations) return cachedLocalizations

  const directory = path.isAbsolute(config.localization.sourceDirectory)
    ? config.localization.sourceDirectory
    : path.resolve(ROOT, config.localization.sourceDirectory)
  if (!fs.existsSync(directory)) {
    throw new Error(`Monetization localization source directory not found: ${directory}`)
  }

  const sourceFiles = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -'.json'.length))
    .sort((left, right) => left.localeCompare(right))

  if (!sourceFiles.includes(config.localization.sourceLocale)) {
    throw new Error(
      `Source locale ${config.localization.sourceLocale}.json not found in ${directory}`
    )
  }

  const localizations = sourceFiles.map((sourceLocale) => {
    const storeLocales = STORE_LOCALES[sourceLocale]
    if (!storeLocales) {
      throw new Error(
        `No App Store/Google Play locale mapping for ${sourceLocale}. Add it to scripts/monetization/localizations.ts.`
      )
    }
    if (sourceLocale === config.localization.sourceLocale) {
      return buildSourceLocalization(config, sourceLocale)
    }
    return buildDerivedLocalization(
      config,
      sourceLocale,
      storeLocales,
      loadResource(path.join(directory, `${sourceLocale}.json`))
    )
  })

  const duplicateApple = localizations.find(
    (item, index) =>
      localizations.findIndex((candidate) => candidate.appleLocale === item.appleLocale) !== index
  )
  const duplicateGoogle = localizations.find(
    (item, index) =>
      localizations.findIndex((candidate) => candidate.googleLocale === item.googleLocale) !== index
  )
  if (duplicateApple) throw new Error(`Duplicate Apple locale ${duplicateApple.appleLocale}`)
  if (duplicateGoogle) throw new Error(`Duplicate Google locale ${duplicateGoogle.googleLocale}`)

  for (const localization of localizations) {
    if (characterCount(localization.subscriptionTitle) > 55) {
      throw new Error(
        `Google ${localization.googleLocale} subscription title exceeds 55 characters`
      )
    }
    if (characterCount(localization.subscriptionDescription) > 200) {
      throw new Error(
        `Google ${localization.googleLocale} subscription description exceeds 200 characters`
      )
    }
    for (const benefit of localization.subscriptionBenefits) {
      if (characterCount(benefit) > 40) {
        throw new Error(`Google ${localization.googleLocale} benefit exceeds 40 characters`)
      }
    }
    for (const [key, product] of Object.entries(localization.products)) {
      const nameLength = characterCount(product.displayName)
      if (nameLength < 2 || nameLength > 30) {
        throw new Error(
          `Apple ${localization.appleLocale} ${key} display name must be 2-30 characters`
        )
      }
      if (characterCount(product.description) > 45) {
        throw new Error(
          `Apple ${localization.appleLocale} ${key} description exceeds 45 characters`
        )
      }
    }
  }

  cachedConfig = config
  cachedLocalizations = localizations
  return localizations
}
