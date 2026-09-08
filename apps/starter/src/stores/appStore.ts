import { APP_STATE_PERSIST_NAME, createAppStore } from '@rhysle/core/stores/createAppStore'
import { coreSliceModules } from '@rhysle/core/stores/features/registry'
import type { AnySliceConfig } from '@rhysle/core/stores/slices/registry'
const context = require.context('./features', false, /\.ts$/)
export const appSliceModules: Record<string, AnySliceConfig> = { ...coreSliceModules }
for (const key of context.keys()) {
  if (key in appSliceModules) throw new Error(`Duplicate core slice: ${key}`)
  appSliceModules[key] = context(key) as AnySliceConfig
}
export const useAppStore = createAppStore<AppSlices>(appSliceModules)
export { APP_STATE_PERSIST_NAME }
export type AppStore = AppSlices
export type AppStorePersistedState =
  import('@rhysle/core/stores/slices/types').AppPersistedState<AppSlices>
