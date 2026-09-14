import type { PppCountryData, PppSnapshot } from './types'

export interface WorldBankObservation {
  country: { id: string; value: string }
  countryiso3code: string
  date: string
  value: number | null
}

interface BuildSnapshotOptions {
  targetYear: number
  retrievedAt: string
  worldBankLastUpdated: string
  pppObservations: readonly WorldBankObservation[]
  exchangeObservations: readonly WorldBankObservation[]
}

const FALLBACK_YEARS = 2

export const buildPppSnapshot = ({
  targetYear,
  retrievedAt,
  worldBankLastUpdated,
  pppObservations,
  exchangeObservations,
}: BuildSnapshotOptions): PppSnapshot => {
  const observationKey = (item: WorldBankObservation): string => `${item.country.id}:${item.date}`
  const exchangeByCountryYear = new Map(
    exchangeObservations.map((item) => [observationKey(item), item])
  )
  const pppByCountryYear = new Map(pppObservations.map((item) => [observationKey(item), item]))
  const usByYear = new Map<number, { ppp: number; exchange: number }>()

  for (let year = targetYear - FALLBACK_YEARS; year <= targetYear; year += 1) {
    const usPpp = pppByCountryYear.get(`US:${year}`)?.value
    const usExchange = exchangeByCountryYear.get(`US:${year}`)?.value
    if (usPpp && usPpp > 0 && usExchange && usExchange > 0) {
      usByYear.set(year, { ppp: usPpp, exchange: usExchange })
    }
  }

  const countriesByIso2 = new Map<string, WorldBankObservation>()
  for (const item of pppObservations) {
    if (/^[A-Z]{2}$/.test(item.country.id) && /^[A-Z]{3}$/.test(item.countryiso3code)) {
      countriesByIso2.set(item.country.id, item)
    }
  }

  const countries: PppCountryData[] = []
  for (const [iso2, example] of countriesByIso2) {
    for (let year = targetYear; year >= targetYear - FALLBACK_YEARS; year -= 1) {
      const pppValue = pppByCountryYear.get(`${iso2}:${year}`)?.value
      const exchangeValue = exchangeByCountryYear.get(`${iso2}:${year}`)?.value
      const us = usByYear.get(year)
      if (!(pppValue && pppValue > 0 && exchangeValue && exchangeValue > 0 && us)) continue
      countries.push({
        iso2,
        iso3: example.countryiso3code,
        name: example.country.value,
        sourceYear: year,
        pppConversionFactor: pppValue,
        officialExchangeRate: exchangeValue,
        usPppConversionFactor: us.ppp,
        usOfficialExchangeRate: us.exchange,
        normalizedRatio: pppValue / exchangeValue / (us.ppp / us.exchange),
      })
      break
    }
  }

  return {
    id: `world-bank-${targetYear}`,
    source: 'World Bank World Development Indicators',
    license: 'CC BY-4.0',
    sourceUrl: 'https://api.worldbank.org/v2/country/all/indicator',
    licenseUrl: 'https://datacatalog.worldbank.org/public-licenses#cc-by',
    targetYear,
    fallbackStartYear: targetYear - FALLBACK_YEARS,
    retrievedAt,
    worldBankLastUpdated,
    indicators: {
      pppConversionFactor: 'PA.NUS.PPP',
      officialExchangeRate: 'PA.NUS.FCRF',
    },
    countries: countries.sort((left, right) => left.iso2.localeCompare(right.iso2)),
  }
}
