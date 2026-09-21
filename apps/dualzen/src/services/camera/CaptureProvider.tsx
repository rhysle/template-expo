import { createContext, type ReactNode, use } from 'react'

import { type CameraFlipController, useCameraFlip } from './useCameraFlip'
import { type CaptureController, useCaptureController } from './useRecorder'

export type CaptureContextController = CaptureController & CameraFlipController

const CaptureContext = createContext<CaptureContextController | null>(null)

export function CaptureProvider({
  active,
  retained,
  children,
}: {
  active: boolean
  retained: boolean
  children: ReactNode
}) {
  const controller = useCaptureController(active, retained)
  const cameraFlip = useCameraFlip(controller)
  return <CaptureContext value={{ ...controller, ...cameraFlip }}>{children}</CaptureContext>
}

export function useCapture() {
  const controller = use(CaptureContext)
  if (!controller) throw new Error('useCapture must be used within CaptureProvider')
  return controller
}
