import { createContext, type ReactNode, use } from 'react'

import { type MediaType } from './types'
import { type CaptureController, useCaptureController } from './useRecorder'

const CaptureContext = createContext<CaptureController | null>(null)

export function CaptureProvider({
  active,
  mediaType,
  children,
}: {
  active: boolean
  mediaType: MediaType
  children: ReactNode
}) {
  const controller = useCaptureController(active, mediaType)
  return <CaptureContext value={controller}>{children}</CaptureContext>
}

export function useCapture() {
  const controller = use(CaptureContext)
  if (!controller) throw new Error('useCapture must be used within CaptureProvider')
  return controller
}
