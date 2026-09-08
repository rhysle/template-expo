import { buildMigrate, type FeatureMigrationConfig, SLICE_VERSIONS_KEY } from './migrate'
import type { AppPersistedState } from './types'

export type AnySliceConfig = {
  sliceConfig: {
    create: (set: any, get: any) => any
    persistExcludeKeys: readonly string[]
    version?: number
    migrations?: Record<number, (state: Record<string, unknown>) => Record<string, unknown>>
  }
}

export const createSliceRegistry = <T extends object>(
  featureModules: Record<string, AnySliceConfig>
) => {
  const featureKeys = Object.keys(featureModules)
  const sliceNames = new Set<string>()
  for (const key of featureKeys) {
    const name = key.replace(/^\.\//, '').replace(/\.ts$/, '')
    if (sliceNames.has(name)) throw new Error(`Duplicate slice name: ${name}`)
    sliceNames.add(name)
  }
  const featureCtx = (key: string): AnySliceConfig => featureModules[key]
  function createAppSlices(set: (updater: (state: T) => void) => void, get: () => T): T {
    return featureKeys.reduce((acc, key) => {
      const sliceName = key.replace(/^\.\//, '').replace(/\.ts$/, '')
      const mod = featureCtx(key) as AnySliceConfig
      const namespacedSet = (updater: (s: any) => void) =>
        set((state: any) => updater(state[sliceName]))
      const namespacedGet = () => (get() as any)[sliceName]
      return { ...acc, [sliceName]: mod.sliceConfig.create(namespacedSet, namespacedGet) }
    }, {} as T)
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

  const migratePersistedState = buildMigrate(_featureMigrations)

  /**
   * Sentinel version for Zustand persist. Set to 1 to trigger the migrate function
   * on stores that were created before the migration system was added.
   * Per-feature versioning is handled inside `_sliceVersions` - this value stays at 1.
   */
  const STORE_VERSION = 1

  const selectPersistedState = (state: T): AppPersistedState<T> => {
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
    return result as unknown as AppPersistedState<T>
  }

  return { createAppSlices, migratePersistedState, STORE_VERSION, selectPersistedState }
}
