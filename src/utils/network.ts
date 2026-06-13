import firebase from '@react-native-firebase/app'
import Constants from 'expo-constants'
import * as Network from 'expo-network'

import { OfflineError } from '@/utils/OfflineError'

export const assertOnline = async (): Promise<void> => {
  const state = await Network.getNetworkStateAsync()
  if (state.isConnected === false || state.isInternetReachable === false) {
    throw new OfflineError()
  }
}

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
