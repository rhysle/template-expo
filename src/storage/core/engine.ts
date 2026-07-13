import { createMMKV } from 'react-native-mmkv'

// TODO: implement dynamic storage id here instead of hardcoded
const STORAGE_ID = 'currency-converter-storage'

export const storage = createMMKV({
  id: STORAGE_ID,
})
