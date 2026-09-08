import { useFoundationRuntime } from '../runtime'
import type { FoundationSlices } from './foundationTypes'
export type FoundationStoreHook = <U>(selector: (state: FoundationSlices) => U) => U
export const useFoundationStore: FoundationStoreHook = (selector) => {
  const runtime = useFoundationRuntime()
  return runtime.store(selector)
}
