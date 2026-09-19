import { NativeModule, requireNativeModule, requireNativeView } from 'expo'
import type { ViewProps } from 'react-native'

type RecorderEvents = { onStopped: (event: { result: string }) => void }
declare class RecorderModule extends NativeModule<RecorderEvents> {
  start(request: string): Promise<void>
  stop(): Promise<string>
  stats(): Promise<string>
  canEncode(longEdge: number, fps: number, hdr: boolean): Promise<boolean>
  capabilities(): Promise<string>
  exportMedia(uri: string, mediaType: 'video' | 'photo', start: number, end: number): Promise<string>
  thumbnail(uri: string, destination: string): Promise<void>
  writeManifest(uri: string, content: string): Promise<void>
}
export default requireNativeModule<RecorderModule>('DualRecorder')
export const DualRecorderPreview = requireNativeView<
  ViewProps & {
    channel: number
    portrait: boolean
    cropPosition: number
    mirrored: boolean
  }
>('DualRecorder')
