import { useAutoPaywall } from '@shared/core/services/revenueCat'
import { Stack } from 'expo-router'

import { useCameraState } from '@/stores/features/camera'

export default function ProductLayout() {
  const { phase } = useCameraState()
  useAutoPaywall(phase !== 'idle')
  return <Stack screenOptions={{ headerShown: false }} />
}
