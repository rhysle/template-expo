import { useCoreRuntime } from '../runtime'
import type { CoreSlices } from './coreTypes'
export type CoreStoreHook = <U>(selector: (state: CoreSlices) => U) => U
export const useCoreStore: CoreStoreHook = (selector) => {
  const runtime = useCoreRuntime()
  return runtime.store(selector)
}
