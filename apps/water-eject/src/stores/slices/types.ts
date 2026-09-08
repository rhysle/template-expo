export type {
  AppPersistedState,
  ExcludeKeys,
  SliceConfig,
  SliceMigration,
} from '@rhysle/mobile-foundation/stores/slices/types'
export const getUseAppStore = () =>
  // Lazy binding avoids a cycle between feature declarations and store creation.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../appStore') as typeof import('../appStore')).useAppStore
