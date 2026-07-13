import type { SliceMigration } from './types'

export const SLICE_VERSIONS_KEY = '_sliceVersions'

export type FeatureMigrationConfig = {
  name: string
  version: number
  migrations: Record<number, SliceMigration<Record<string, unknown>>>
}

/**
 * Builds a Zustand persist `migrate` function that runs per-feature migrations.
 *
 * Each feature tracks its own version independently via a `_sliceVersions` record
 * stored in the persisted state blob. This allows features to be added, removed,
 * or copied between projects without version conflicts.
 */
export function buildMigrate(features: FeatureMigrationConfig[]) {
  return (persistedState: unknown, _zustandVersion: number): Record<string, unknown> => {
    const state = (persistedState ?? {}) as Record<string, unknown>
    const versions = {
      ...((state[SLICE_VERSIONS_KEY] ?? {}) as Record<string, number>),
    }

    for (const feature of features) {
      const storedVersion = versions[feature.name] ?? 0

      for (let v = storedVersion + 1; v <= feature.version; v++) {
        const migrateFn = feature.migrations[v]
        if (migrateFn) {
          const sliceState = (state[feature.name] ?? {}) as Record<string, unknown>
          Object.assign(sliceState, migrateFn(sliceState))
          state[feature.name] = sliceState
        }
      }

      versions[feature.name] = feature.version
    }

    state[SLICE_VERSIONS_KEY] = versions
    return state
  }
}
