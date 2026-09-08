import { createCoreRuntime } from '@rhysle/core/runtime'

import { AppConfig } from './configs/AppConfig'
import * as fonts from './configs/fonts'
import * as ads from './services/ads'
import { useAppStore } from './stores/appStore'
import { themes } from './theme/themes'
export const coreRuntime = createCoreRuntime({
  store: useAppStore,
  config: AppConfig,
  fonts,
  themes,
  ads,
})
