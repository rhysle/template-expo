import type { PersistedState } from './persist'

export type AppPersistedState = {
  [K in keyof AppSlices]: PersistedState<AppSlices[K]>
} & { _sliceVersions?: Record<string, number> }

export type ExcludeKeys<T> = readonly (keyof T)[]

/** A single migration step. Receives the slice's own persisted state, returns the mutated slice state. */
export type SliceMigration<T extends object> = (state: Partial<T>) => Partial<T>

export type SliceConfig<T extends object> = {
  create: (...args: any[]) => T
  persistExcludeKeys: ExcludeKeys<T>
  /**
   * Current schema version for this slice. Defaults to 0 (no migrations).
   * Bump by 1 each time a migration is added.
   */
  version?: number
  /**
   * Ordered migration functions indexed 1..version.
   * migrations[1] migrates from version 0 → 1, migrations[2] from 1 → 2, etc.
   */
  migrations?: Record<number, SliceMigration<T>>
}

/** Lazy accessor for useAppStore to avoid circular dependencies in feature files. */
export const getUseAppStore = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../appStore') as { useAppStore: <U>(selector: (state: AppSlices) => U) => U })
    .useAppStore
