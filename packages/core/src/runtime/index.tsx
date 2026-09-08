import { createContext, type PropsWithChildren, useContext } from 'react'

import { type CoreAds } from '../services/ads'
import type { CoreStoreHook } from '../stores/binding'
import type { Theme, ThemeId } from '../theme/types'
import { type CoreConfig } from './config'
import { type CoreFonts } from './fonts'
export interface CoreRuntime {
  store: CoreStoreHook
  config: CoreConfig
  fonts: CoreFonts
  themes: Record<ThemeId, Theme>
  ads: CoreAds
}
export const createCoreRuntime = (options: CoreRuntime): CoreRuntime => {
  return options
}
const Context = createContext<CoreRuntime | null>(null)
export const CoreProvider = ({
  runtime,
  children,
}: PropsWithChildren<{ runtime: CoreRuntime }>) => (
  <Context.Provider value={runtime}>{children}</Context.Provider>
)
export const useCoreRuntime = (): CoreRuntime => {
  const runtime = useContext(Context)
  if (!runtime) throw new Error('CoreProvider is required')
  return runtime
}
