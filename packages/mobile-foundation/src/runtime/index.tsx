import { createContext, type PropsWithChildren, useContext } from 'react'

import { type FoundationAds } from '../services/ads'
import type { FoundationStoreHook } from '../stores/binding'
import type { Theme, ThemeId } from '../theme/types'
import { type FoundationConfig } from './config'
import { type FoundationFonts } from './fonts'
export interface FoundationRuntime {
  store: FoundationStoreHook
  config: FoundationConfig
  fonts: FoundationFonts
  themes: Record<ThemeId, Theme>
  ads: FoundationAds
}
export const createFoundationRuntime = (options: FoundationRuntime): FoundationRuntime => {
  return options
}
const Context = createContext<FoundationRuntime | null>(null)
export const FoundationProvider = ({
  runtime,
  children,
}: PropsWithChildren<{ runtime: FoundationRuntime }>) => (
  <Context.Provider value={runtime}>{children}</Context.Provider>
)
export const useFoundationRuntime = (): FoundationRuntime => {
  const runtime = useContext(Context)
  if (!runtime) throw new Error('FoundationProvider is required')
  return runtime
}
