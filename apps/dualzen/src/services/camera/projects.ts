import { recordError } from '@shared/core/services/sentry'
import { randomUUID } from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

import { AnalyticsAppEvents, trackEvent } from '@/services/firebase/analytics'
import { useAppStore } from '@/stores/appStore'

import NativeRecorder from '../../../modules/dual-recorder/src/DualRecorderModule'
import {
  DEFAULT_PROJECT_ID,
  type ExportReceipt,
  type ExportResult,
  type OutputKind,
  type PhotoCapture,
  type Project,
  type ProjectMedia,
  type VideoCapture,
} from './types'

export const dualZenRoot = new Directory(Paths.document, 'DualZen')
export const mediaRoot = new Directory(dualZenRoot, 'media')
export const mediaDirectory = (id: string) => new Directory(mediaRoot, id)
export const thumbnailFile = (id: string) => new File(mediaDirectory(id), 'thumbnail.jpg')

type MediaExportSource = 'automatic' | 'manual'

function exportFailureReason(cause: unknown) {
  const message = (cause instanceof Error ? cause.message : String(cause)).toLowerCase()
  if (
    message.includes('storage') ||
    message.includes('disk') ||
    message.includes('space') ||
    message.includes('enospc')
  )
    return 'storage'
  if (message.includes('permission') || message.includes('denied')) return 'permission'
  return 'export_failed'
}

function readyOutput(media: ProjectMedia, kind: OutputKind) {
  const output = media.outputs.find((item) => item.kind === kind && item.ready)
  if (!output) throw new Error('Media output is not available')
  return output
}

function normalizeExportReceipts(value: unknown): ExportReceipt[] {
  if (!Array.isArray(value)) return []
  const receipts = new Map<OutputKind, ExportReceipt>()
  for (const raw of value) {
    if (
      raw &&
      typeof raw === 'object' &&
      (raw.kind === 'portrait' || raw.kind === 'landscape') &&
      typeof raw.assetId === 'string'
    )
      receipts.set(raw.kind, { kind: raw.kind, assetId: raw.assetId })
  }
  return [...receipts.values()]
}

export const mediaFile = (media: ProjectMedia, kind: OutputKind) =>
  new File(mediaDirectory(media.id), readyOutput(media, kind).filename)

export const videoFile = (video: VideoCapture, kind: OutputKind) => mediaFile(video, kind)
export const photoFile = (photo: PhotoCapture, kind: OutputKind) => mediaFile(photo, kind)

export function allocateMedia() {
  const id = randomUUID()
  const directory = mediaDirectory(id)
  directory.create({ intermediates: true, idempotent: true })
  return { id, directory }
}

async function writeJSON(file: File, value: unknown) {
  await NativeRecorder.writeManifest(file.uri, JSON.stringify(value))
}

export async function saveMedia(media: ProjectMedia) {
  await writeJSON(new File(mediaDirectory(media.id), 'manifest.json'), media)
  useAppStore.getState().projects.putMedia(media)
}

export async function saveProject(project: Project) {
  const directory = new Directory(dualZenRoot, 'projects')
  directory.create({ intermediates: true, idempotent: true })
  await writeJSON(new File(directory, project.id + '.json'), project)
  useAppStore.getState().projects.putProject(project)
}

export async function hydrateProjects() {
  dualZenRoot.create({ intermediates: true, idempotent: true })
  const projects = new Directory(dualZenRoot, 'projects')
  if (projects.exists)
    for (const file of projects.list()) {
      if (!(file instanceof File) || !file.name.endsWith('.json')) continue
      try {
        const project = JSON.parse(await file.text()) as Project
        if (
          typeof project.id === 'string' &&
          (project.name === null || typeof project.name === 'string')
        )
          useAppStore.getState().projects.putProject(project)
      } catch {
        /* A corrupt manifest must not hide other saved projects. */
      }
    }

  const defaultProject = useAppStore
    .getState()
    .projects.projects.find((project) => project.id === DEFAULT_PROJECT_ID) ?? {
    id: DEFAULT_PROJECT_ID,
    name: null,
    createdAt: 0,
  }
  if (!new File(dualZenRoot, 'projects', DEFAULT_PROJECT_ID + '.json').exists)
    await saveProject(defaultProject)

  const catalog = useAppStore.getState().projects
  if (!catalog.projects.some((project) => project.id === catalog.selectedProjectId))
    catalog.selectProject(DEFAULT_PROJECT_ID)

  if (!mediaRoot.exists) return
  for (const directory of mediaRoot.list()) {
    if (!(directory instanceof Directory)) continue
    const manifest = new File(directory, 'manifest.json')
    if (!manifest.exists) continue
    try {
      const raw = JSON.parse(await manifest.text()) as ProjectMedia & {
        trim?: unknown
        outputs: (ProjectMedia['outputs'][number] & { keyframes?: unknown })[]
        exports?: unknown
      }
      if (
        typeof raw.id !== 'string' ||
        raw.id !== directory.name ||
        !['video', 'photo'].includes(raw.mediaType) ||
        !Array.isArray(raw.outputs)
      )
        continue
      const { trim: _legacyTrim, outputs: rawOutputs, exports: rawExports, ...base } = raw
      const media = {
        ...base,
        outputs: rawOutputs.map(({ keyframes: _legacyKeyframes, ...output }) => ({
          ...output,
          ready: output.ready && new File(directory, output.filename).exists,
        })),
        exports: normalizeExportReceipts(rawExports),
      } as ProjectMedia
      if (!catalog.projects.some((project) => project.id === media.projectId))
        media.projectId = DEFAULT_PROJECT_ID
      catalog.putMedia(media)
    } catch {
      /* Never remove originals automatically because metadata cannot be read. */
    }
  }
}

export async function deleteMedia(media: ProjectMedia) {
  const directory = mediaDirectory(media.id)
  if (directory.exists) directory.delete()
  useAppStore.getState().projects.removeMedia(media.id)
}

export async function deleteMediaBatch(mediaItems: ProjectMedia[]) {
  let firstFailure: unknown

  for (const media of mediaItems) {
    try {
      await deleteMedia(media)
    } catch (cause) {
      firstFailure ??= cause
    }
  }

  if (firstFailure) throw firstFailure
}

export async function deleteProject(id: string) {
  if (id === DEFAULT_PROJECT_ID) return
  for (const media of useAppStore.getState().projects.media.filter((item) => item.projectId === id))
    await deleteMedia(media)
  const manifest = new File(dualZenRoot, 'projects', id + '.json')
  if (manifest.exists) manifest.delete()
  useAppStore.getState().projects.removeProject(id)
}

export async function mutateProjects(action: () => Promise<unknown>) {
  if (useAppStore.getState().camera.phase !== 'idle') throw new Error('Camera is busy')
  useAppStore.getState().camera.setPhase('finalizing')
  try {
    return await action()
  } finally {
    useAppStore.getState().camera.setPhase('idle')
  }
}

export async function exportMedia(
  media: ProjectMedia,
  kinds: OutputKind[],
  anotherCopy = false,
  source: MediaExportSource = 'manual'
): Promise<ExportResult[]> {
  if (useAppStore.getState().camera.phase !== 'idle') throw new Error('Camera is busy')
  useAppStore.getState().camera.setPhase('exporting')
  const results: ExportResult[] = []
  let current = useAppStore.getState().projects.media.find((item) => item.id === media.id) ?? media
  let outcomeTracked = false
  try {
    if (anotherCopy) {
      current = {
        ...current,
        exports: current.exports.filter((receipt) => !kinds.includes(receipt.kind)),
      }
      await saveMedia(current)
    }
    for (const kind of kinds) {
      const existing = current.exports.find((receipt) => receipt.kind === kind)
      if (existing) {
        results.push({ kind, assetId: existing.assetId })
        continue
      }
      try {
        const file = mediaFile(current, kind)
        if (Paths.availableDiskSpace < file.size + 32 * 1024 * 1024)
          throw new Error('Not enough space to export; original is safe')
        const assetId = await NativeRecorder.exportMedia(file.uri, current.mediaType)
        current = { ...current, exports: [...current.exports, { kind, assetId }] }
        useAppStore.getState().projects.putMedia(current)
        await saveMedia(current)
        results.push({ kind, assetId })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.toLowerCase().includes('not enough space'))
          recordError(error, 'projects.exportMedia', {
            media_type: current.mediaType,
            output_kind: kind,
            another_copy: anotherCopy,
          })
        results.push({ kind, error: error instanceof Error ? error.message : String(error) })
      }
    }
    const failed = results.filter((result) => result.error)
    const eventParams = {
      media_type: current.mediaType,
      source,
      output_count: kinds.length,
      succeeded_output_count: results.length - failed.length,
      another_copy: anotherCopy ? 1 : 0,
    }
    if (failed.length) {
      trackEvent(AnalyticsAppEvents.MEDIA_EXPORT_FAILED, {
        ...eventParams,
        reason: exportFailureReason(failed[0].error),
      })
    } else trackEvent(AnalyticsAppEvents.MEDIA_EXPORT_COMPLETED, eventParams)
    outcomeTracked = true
  } catch (cause) {
    if (!outcomeTracked)
      trackEvent(AnalyticsAppEvents.MEDIA_EXPORT_FAILED, {
        media_type: current.mediaType,
        source,
        output_count: kinds.length,
        succeeded_output_count: results.filter((result) => !result.error).length,
        another_copy: anotherCopy ? 1 : 0,
        reason: exportFailureReason(cause),
      })
    throw cause
  } finally {
    useAppStore.getState().camera.setPhase('idle')
  }
  return results
}

export async function shareMedia(media: ProjectMedia, kind: OutputKind) {
  const details = { media_type: media.mediaType, output_kind: kind }
  trackEvent(AnalyticsAppEvents.MEDIA_SHARE_REQUESTED, details)
  if (!(await Sharing.isAvailableAsync())) {
    trackEvent(AnalyticsAppEvents.MEDIA_SHARE_FAILED, { ...details, reason: 'unavailable' })
    throw new Error('Sharing is unavailable')
  }

  const file = mediaFile(media, kind)
  const isPhoto = media.mediaType === 'photo'
  const isMov = media.mediaType === 'video' && media.settings.container === 'mov'
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: isPhoto ? 'image/jpeg' : isMov ? 'video/quicktime' : 'video/mp4',
      UTI: isPhoto ? 'public.jpeg' : isMov ? 'com.apple.quicktime-movie' : 'public.mpeg-4',
    })
  } catch (cause) {
    recordError(cause, 'projects.shareMedia', details)
    trackEvent(AnalyticsAppEvents.MEDIA_SHARE_FAILED, { ...details, reason: 'share_failed' })
    throw cause
  }
}
