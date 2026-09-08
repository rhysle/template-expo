import { sliceConfig as ads } from './ads'
import { sliceConfig as appReview } from './appReview'
import { sliceConfig as onboarding } from './onboarding'
import { sliceConfig as otaUpdate } from './otaUpdate'
import { sliceConfig as paywall } from './paywall'
import { sliceConfig as snackbar } from './snackbar'
import { sliceConfig as subscription } from './subscription'
import { sliceConfig as theme } from './theme'
import { sliceConfig as userIdentity } from './userIdentity'
export const coreSliceModules = {
  './otaUpdate.ts': { sliceConfig: otaUpdate },
  './userIdentity.ts': { sliceConfig: userIdentity },
  './onboarding.ts': { sliceConfig: onboarding },
  './ads.ts': { sliceConfig: ads },
  './appReview.ts': { sliceConfig: appReview },
  './subscription.ts': { sliceConfig: subscription },
  './paywall.ts': { sliceConfig: paywall },
  './theme.ts': { sliceConfig: theme },
  './snackbar.ts': { sliceConfig: snackbar },
}
