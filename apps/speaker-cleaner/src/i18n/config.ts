import { initI18n as initialize } from '@rhysle/core/i18n/config'

import { resources } from './resources'
export { getDeviceLanguage } from '@rhysle/core/i18n/config'
export const initI18n = () => initialize(resources)
