import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'

import { audioController } from './audioController'

export const useAudioController = () =>
  useSyncExternalStore(
    audioController.subscribe,
    audioController.getSnapshot,
    audioController.getSnapshot
  )

export const useAudioToolLifecycle = () => {
  useFocusEffect(
    useCallback(
      () => () => {
        void audioController.stop('blur')
      },
      []
    )
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void audioController.stop('background')
    })

    return () => subscription.remove()
  }, [])
}
