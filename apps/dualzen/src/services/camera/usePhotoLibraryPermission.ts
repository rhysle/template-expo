import { recordError } from '@shared/core/services/sentry'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'

import NativeRecorder, {
  type PhotoLibraryPermissionStatus,
} from '../../../modules/dual-recorder/src/DualRecorderModule'

export function usePhotoLibraryPermission() {
  const [status, setStatus] = useState<PhotoLibraryPermissionStatus>(() =>
    NativeRecorder.photoLibraryPermissionStatus()
  )
  const [requesting, setRequesting] = useState(false)
  const pendingRequest = useRef<Promise<boolean> | null>(null)

  const refresh = useCallback(() => {
    setStatus(NativeRecorder.photoLibraryPermissionStatus())
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refresh()
    })
    return () => subscription.remove()
  }, [refresh])

  const requestPermission = useCallback(() => {
    if (pendingRequest.current) return pendingRequest.current

    const request = (async () => {
      setRequesting(true)
      try {
        const nextStatus = await NativeRecorder.requestPhotoLibraryPermission()
        setStatus(nextStatus)
        return nextStatus === 'authorized'
      } catch (cause) {
        recordError(cause, 'projects.requestPhotoLibraryPermission', { platform: Platform.OS })
        refresh()
        return false
      } finally {
        setRequesting(false)
        pendingRequest.current = null
      }
    })()

    pendingRequest.current = request
    return request
  }, [refresh])

  return {
    status,
    hasPermission: status === 'authorized',
    canRequestPermission: status === 'not-determined',
    requesting,
    requestPermission,
    refresh,
  }
}
