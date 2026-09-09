import { initI18n as initialize } from '@shared/core/i18n/config'

import { resources } from './resources'
export { getDeviceLanguage } from '@shared/core/i18n/config'
export const initI18n = () => initialize(resources)
