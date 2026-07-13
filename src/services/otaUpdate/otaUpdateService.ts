import * as Updates from 'expo-updates'

import { withTimeout } from '@/utils/withTimeout'

// expo-updates has no built-in timeout. Without this, a stalled DNS / half-open
// TCP can leave checkForUpdateAsync / fetchUpdateAsync pending indefinitely,
// which (in useOtaUpdateInit) traps the `isCheckingRef` guard true forever and
// silently disables all future update checks for the rest of the session.
const UPDATE_CHECK_TIMEOUT_MS = 15_000
// fetchUpdateAsync downloads the full JS bundle — allow more time for slow connections.
const UPDATE_DOWNLOAD_TIMEOUT_MS = 60_000

/**
 * Queries EAS Update server for a new update.
 * Returns true if one is available. Throws if network unavailable, the request
 * fails, or the call does not settle within UPDATE_CHECK_TIMEOUT_MS.
 * Callers should catch.
 */
export const checkForUpdate = async (): Promise<boolean> => {
  const result = await withTimeout(
    Updates.checkForUpdateAsync(),
    UPDATE_CHECK_TIMEOUT_MS,
    'OTA update check timed out'
  )
  return result.isAvailable
}

/**
 * Downloads the latest available update to device storage.
 * Returns true if the downloaded bundle is genuinely new (not a re-download
 * of the currently running update). Throws on network/storage failure or if
 * the call does not settle within UPDATE_DOWNLOAD_TIMEOUT_MS.
 */
export const downloadUpdate = async (): Promise<boolean> => {
  const result = await withTimeout(
    Updates.fetchUpdateAsync(),
    UPDATE_DOWNLOAD_TIMEOUT_MS,
    'OTA update download timed out'
  )
  return result.isNew
}

/**
 * Reloads the app with the most recently downloaded update bundle.
 * In practice this call never resolves - the process terminates and restarts.
 */
export const reloadApp = (): Promise<void> => Updates.reloadAsync()

/**
 * Returns the UUID of the currently-running Expo update, whether it was
 * downloaded via EAS Update or embedded in the native build.
 */
export const getCurrentUpdateId = (): string | null => Updates.updateId ?? null

/**
 * Returns true when the app launched the update embedded in the native build.
 */
export const isEmbeddedLaunch = (): boolean => Updates.isEmbeddedLaunch

/**
 * Returns the UUID of the currently-running downloaded OTA update, or null
 * when the app is running its embedded build-time bundle.
 */
export const getCurrentOtaUpdateId = (): string | null => {
  const updateId = getCurrentUpdateId()
  if (updateId === null || isEmbeddedLaunch()) return null
  return updateId
}
