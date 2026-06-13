import { buildMigrate, type FeatureMigrationConfig, SLICE_VERSIONS_KEY } from './migrate'
import type { AppPersistedState } from './types'

const featureCtx = require.context('../features', false, /\.ts$/)
const featureKeys = featureCtx.keys().filter((k) => k !== './index.ts')

type AnySliceConfig = {
  sliceConfig: {
    create: (set: any, get: any) => any
    persistExcludeKeys: readonly string[]
    version?: number
    migrations?: Record<number, (state: Record<string, unknown>) => Record<string, unknown>>
  }
}

export function createAppSlices(
  set: (updater: (state: AppSlices) => void) => void,
  get: () => AppSlices
): AppSlices {
  return featureKeys.reduce((acc, key) => {
    const sliceName = key.replace(/^\.\//, '').replace(/\.ts$/, '')
    const mod = featureCtx(key) as AnySliceConfig
    const namespacedSet = (updater: (s: any) => void) =>
      set((state: any) => updater(state[sliceName]))
    const namespacedGet = () => (get() as any)[sliceName]
    return { ...acc, [sliceName]: mod.sliceConfig.create(namespacedSet, namespacedGet) }
  }, {} as AppSlices)
}

const _persistExcludeKeysBySlice: Record<string, readonly string[]> = featureKeys.reduce(
  (acc, key) => {
    const sliceName = key.replace(/^\.\//, '').replace(/\.ts$/, '')
    const mod = featureCtx(key) as AnySliceConfig
    return { ...acc, [sliceName]: mod.sliceConfig.persistExcludeKeys }
  },
  {} as Record<string, readonly string[]>
)

const _featureMigrations: FeatureMigrationConfig[] = []

featureKeys.forEach((key) => {
  const mod = featureCtx(key) as AnySliceConfig
  const config = mod.sliceConfig
  if (config.version && config.version > 0) {
    _featureMigrations.push({
      name: key.replace(/^\.\//, '').replace(/\.ts$/, ''),
      version: config.version,
      migrations: config.migrations ?? {},
    })
  }
})

export const migratePersistedState = buildMigrate(_featureMigrations)

/**
 * Sentinel version for Zustand persist. Set to 1 to trigger the migrate function
 * on stores that were created before the migration system was added.
 * Per-feature versioning is handled inside `_sliceVersions` - this value stays at 1.
 */
export const STORE_VERSION = 1

export const selectPersistedState = (state: AppSlices): AppPersistedState => {
  const result: Record<string, Record<string, unknown>> = {}
  for (const [sliceName, excludeKeys] of Object.entries(_persistExcludeKeysBySlice)) {
    const sliceState = (state as any)[sliceName] as Record<string, unknown>
    if (!sliceState) continue
    const persisted: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(sliceState)) {
      if (typeof v !== 'function' && !excludeKeys.includes(k)) {
        persisted[k] = v
      }
    }
    result[sliceName] = persisted
  }
  const stateRecord = state as unknown as Record<string, unknown>
  if (SLICE_VERSIONS_KEY in stateRecord) {
    result[SLICE_VERSIONS_KEY] = stateRecord[SLICE_VERSIONS_KEY] as Record<string, unknown>
  }
  return result as unknown as AppPersistedState
}

export type { AppPersistedState } from './types'
