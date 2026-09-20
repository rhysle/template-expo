import { useEffect, useState } from 'react'
import { cancelAnimation, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useCameraState } from '@/stores/features/camera'

import type { CaptureController } from './useRecorder'

export function useCameraFlip(recorder: CaptureController) {
  const { updateSharedSettings } = useCameraState()
  const [flipTarget, setFlipTarget] = useState<boolean | null>(null)
  const progress = useSharedValue(0)
  const flipping = flipTarget !== null
  const canFlip = recorder.devices.some(
    (device) => device.position === (recorder.settings.front ? 'back' : 'front')
  )

  useEffect(() => {
    if (
      flipTarget === null ||
      recorder.settings.front !== flipTarget ||
      (!recorder.error && (!recorder.ready || recorder.readyDeviceId !== recorder.device?.id))
    )
      return

    progress.set(
      withDelay(
        120,
        withTiming(0, { duration: 220 }, (finished) => {
          if (finished) scheduleOnRN(setFlipTarget, null)
        })
      )
    )
  }, [
    flipTarget,
    recorder.settings.front,
    recorder.ready,
    recorder.readyDeviceId,
    recorder.device?.id,
    recorder.error,
    progress,
  ])

  useEffect(() => () => cancelAnimation(progress), [progress])

  const flipCamera = () => {
    if (
      flipping ||
      recorder.phase !== 'idle' ||
      !recorder.ready ||
      !canFlip ||
      recorder.settings.mode === 'dual'
    )
      return

    const front = !recorder.settings.front
    setFlipTarget(front)
    progress.set(
      withTiming(1, { duration: 160 }, (finished) => {
        if (finished) scheduleOnRN(updateSharedSettings, { front, deviceId: null })
      })
    )
  }

  return { canFlip, flipCamera, flipProgress: progress, flipping }
}

export type CameraFlipController = ReturnType<typeof useCameraFlip>
