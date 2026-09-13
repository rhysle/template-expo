import { DebugScreen } from '@shared/core/devtools'

import { getDeviceLanguage, supportedLanguageCodes } from '@/i18n'
import { appDebugStore, appSliceModules } from '@/stores'

export default function DebugRoute() {
  return (
    <DebugScreen
      getDeviceLanguage={getDeviceLanguage}
      sliceModules={appSliceModules}
      store={appDebugStore}
      supportedLanguageCodes={supportedLanguageCodes}
    />
  )
}
