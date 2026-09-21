import type { OutputKind } from './types'

/**
 * Convert the user-facing crop position into the source-image coordinate space.
 *
 * A mirrored preview reverses only its horizontal axis. Portrait output crops
 * horizontally, while landscape output crops vertically, so only the portrait
 * position needs to be reversed for the front camera.
 */
export const getNativeCropPosition = (kind: OutputKind, position: number, mirrored: boolean) =>
  kind === 'portrait' && mirrored ? 1 - position : position
