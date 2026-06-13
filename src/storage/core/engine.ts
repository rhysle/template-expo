import { createMMKV } from 'react-native-mmkv'

const STORAGE_ID = 'currency-converter-storage'

export const storage = createMMKV({
  id: STORAGE_ID,
})
