import { APP_STATE_PERSIST_NAME, createAppStore } from '@shared/core/stores/createAppStore'
import { coreSliceModules } from '@shared/core/stores/features/registry'
import type { AnySliceConfig } from '@shared/core/stores/slices/registry'
const context = require.context('./features', false, /\.ts$/)
export const appSliceModules: Record<string, AnySliceConfig> = { ...coreSliceModules }
for (const key of context.keys()) {
  if (key in appSliceModules) throw new Error(`Duplicate core slice: ${key}`)
  appSliceModules[key] = context(key) as AnySliceConfig
}
const appStore = createAppStore<AppSlices>(appSliceModules)
export const useAppStore = appStore
export const appDebugStore = {
  getState: appStore.getState,
  persist: { rehydrate: appStore.persist.rehydrate },
}
export { APP_STATE_PERSIST_NAME }
export type AppStore = AppSlices
export type AppStorePersistedState =
  import('@shared/core/stores/slices/types').AppPersistedState<AppSlices>
