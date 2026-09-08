import {
  APP_STATE_PERSIST_NAME,
  createAppStore,
} from '@rhysle/mobile-foundation/stores/createAppStore'
import { foundationSliceModules } from '@rhysle/mobile-foundation/stores/features/registry'
import type { AnySliceConfig } from '@rhysle/mobile-foundation/stores/slices/registry'
const context = require.context('./features', false, /\.ts$/)
export const appSliceModules: Record<string, AnySliceConfig> = { ...foundationSliceModules }
for (const key of context.keys()) {
  if (key in appSliceModules) throw new Error(`Duplicate foundation slice: ${key}`)
  appSliceModules[key] = context(key) as AnySliceConfig
}
export const useAppStore = createAppStore<AppSlices>(appSliceModules)
export { APP_STATE_PERSIST_NAME }
export type AppStore = AppSlices
export type AppStorePersistedState =
  import('@rhysle/mobile-foundation/stores/slices/types').AppPersistedState<AppSlices>
