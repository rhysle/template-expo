import firebase from '@react-native-firebase/app'
import Constants from 'expo-constants'
import * as Network from 'expo-network'

import { OfflineError } from '@/utils/OfflineError'
import { withTimeout } from '@/utils/withTimeout'

export const API_FETCH_TIMEOUT_MS = 15_000

export const isNetworkOnline = (state: Network.NetworkState): boolean =>
  state.isConnected === true && state.isInternetReachable === true

export const assertOnline = async (): Promise<void> => {
  const state = await Network.getNetworkStateAsync()
  if (!isNetworkOnline(state)) {
    throw new OfflineError()
  }
}

export const fetchWithTimeout = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  timeoutMs = API_FETCH_TIMEOUT_MS
): ReturnType<typeof fetch> =>
  withTimeout(fetch(input, init), timeoutMs, 'Network request timed out')

export const getEmulatorHost = (): string => {
  // On simulator: hostUri is "localhost:8081", on real device: "192.168.x.x:8081"
  const hostUri = Constants.expoConfig?.hostUri
  return hostUri ? hostUri.split(':')[0] : 'localhost'
}

export const getCloudFunctionUrl = (functionName: string): string => {
  const projectId = firebase.app().options.projectId
  if (!projectId) throw new Error('Firebase projectId is not configured')

  return __DEV__
    ? `http://${getEmulatorHost()}:5001/${projectId}/us-central1/${functionName}`
    : `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`
}
