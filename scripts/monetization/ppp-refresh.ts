#!/usr/bin/env npx tsx

import fs from 'node:fs'
import path from 'node:path'

import { buildPppSnapshot } from './ppp-dataset'
import type { WorldBankObservation } from './ppp-dataset'

const API_ROOT = 'https://api.worldbank.org/v2/country/all/indicator'
const FALLBACK_YEARS = 2
const INDICATORS = ['PA.NUS.PPP', 'PA.NUS.FCRF'] as const

interface WorldBankMetadata {
  lastupdated: string
}

const targetYear = Number(process.argv[process.argv.indexOf('--year') + 1])
if (
  !Number.isInteger(targetYear) ||
  targetYear < 2000 ||
  targetYear > new Date().getUTCFullYear()
) {
  throw new Error('Usage: npm run monetization:ppp:refresh -- --year YYYY')
}

const fetchIndicator = async (
  indicator: (typeof INDICATORS)[number]
): Promise<{ metadata: WorldBankMetadata; observations: WorldBankObservation[] }> => {
  const startYear = targetYear - FALLBACK_YEARS
  const url = `${API_ROOT}/${indicator}?format=json&date=${startYear}:${targetYear}&per_page=2000`
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`World Bank ${indicator} request failed: HTTP ${response.status}`)
  const payload = (await response.json()) as [WorldBankMetadata, WorldBankObservation[]]
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    throw new Error(`World Bank ${indicator} returned an unexpected response`)
  }
  return { metadata: payload[0], observations: payload[1] }
}

const main = async (): Promise<void> => {
  const [ppp, exchange] = await Promise.all(INDICATORS.map(fetchIndicator))
  const snapshot = buildPppSnapshot({
    targetYear,
    retrievedAt: new Date().toISOString(),
    worldBankLastUpdated:
      [ppp.metadata.lastupdated, exchange.metadata.lastupdated].sort().at(-1) ?? '',
    pppObservations: ppp.observations,
    exchangeObservations: exchange.observations,
  })

  const output = path.resolve(__dirname, 'data', `${snapshot.id}.json`)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`Wrote ${snapshot.countries.length} countries to ${output}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
