import Constants from 'expo-constants'
import { createMMKV } from 'react-native-mmkv'

const STORAGE_ID = `${Constants.expoConfig?.slug ?? 'app'}-storage`

export const storage = createMMKV({
  id: STORAGE_ID,
})
