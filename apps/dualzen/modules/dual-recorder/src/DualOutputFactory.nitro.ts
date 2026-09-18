import type { HybridObject } from 'react-native-nitro-modules'
import type { CameraOutput } from 'react-native-vision-camera'

export interface DualOutputFactory extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  createOutput(channel: number, longEdge: number, hdr: boolean): CameraOutput
}
