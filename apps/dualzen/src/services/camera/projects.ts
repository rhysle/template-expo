import { randomUUID } from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'

import { useAppStore } from '@/stores/appStore'

import NativeRecorder from '../../../modules/dual-recorder/src/DualRecorderModule'
import {
  DEFAULT_PROJECT_ID,
  type ExportResult,
  type OutputKind,
  type Project,
  type Take,
} from './types'

export const recordingsRoot = new Directory(Paths.document, 'DualZen')
export const takeDirectory = (id: string) => new Directory(recordingsRoot, 'takes', id)
export const videoFile = (take: Take, kind: OutputKind) => {
  const output = take.outputs.find((item) => item.kind === kind && item.ready)
  if (!output) throw new Error('Video is not available')
  return new File(takeDirectory(take.id), output.filename)
}
export const thumbnailFile = (id: string) => new File(takeDirectory(id), 'thumbnail.jpg')
export function allocateTake() {
  const id = randomUUID()
  const directory = takeDirectory(id)
  directory.create({ intermediates: true, idempotent: true })
  return { id, directory }
}
async function writeJSON(file: File, value: unknown) {
  await NativeRecorder.writeManifest(file.uri, JSON.stringify(value))
}
export async function saveTake(take: Take) {
  useAppStore.getState().projects.putTake(take)
  await writeJSON(new File(takeDirectory(take.id), 'manifest.json'), take)
}
export async function saveProject(project: Project) {
  const directory = new Directory(recordingsRoot, 'projects')
  directory.create({ intermediates: true, idempotent: true })
  await writeJSON(new File(directory, project.id + '.json'), project)
  useAppStore.getState().projects.putProject(project)
}
export async function hydrateProjects() {
  recordingsRoot.create({ intermediates: true, idempotent: true })
  const projects = new Directory(recordingsRoot, 'projects')
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
  if (!new File(recordingsRoot, 'projects', DEFAULT_PROJECT_ID + '.json').exists)
    await saveProject(defaultProject)
  const catalog = useAppStore.getState().projects
  if (!catalog.projects.some((project) => project.id === catalog.selectedProjectId))
    catalog.selectProject(DEFAULT_PROJECT_ID)
  const takes = new Directory(recordingsRoot, 'takes')
  if (takes.exists)
    for (const directory of takes.list()) {
      if (!(directory instanceof Directory)) continue
      const manifest = new File(directory, 'manifest.json')
      if (!manifest.exists) continue
      try {
        const take = JSON.parse(await manifest.text()) as Take
        if (
          typeof take.id !== 'string' ||
          take.id !== directory.name ||
          !Array.isArray(take.outputs)
        )
          continue
        take.outputs = take.outputs.map((output) => ({
          ...output,
          ready: output.ready && new File(directory, output.filename).exists,
        }))
        if (
          !useAppStore.getState().projects.projects.some((project) => project.id === take.projectId)
        )
          take.projectId = DEFAULT_PROJECT_ID
        useAppStore.getState().projects.putTake(take)
      } catch {
        /* Never remove footage automatically because metadata cannot be read. */
      }
    }
}
export async function deleteTake(take: Take) {
  const directory = takeDirectory(take.id)
  if (directory.exists) directory.delete()
  useAppStore.getState().projects.removeTake(take.id)
}
export async function deleteProject(id: string) {
  if (id === DEFAULT_PROJECT_ID) return
  for (const take of useAppStore.getState().projects.takes.filter((item) => item.projectId === id))
    await deleteTake(take)
  const manifest = new File(recordingsRoot, 'projects', id + '.json')
  if (manifest.exists) manifest.delete()
  useAppStore.getState().projects.removeProject(id)
}
export async function mutateProjects(action: () => Promise<unknown>) {
  if (useAppStore.getState().camera.phase !== 'idle') throw new Error('Recorder is busy')
  useAppStore.getState().camera.setPhase('finalizing')
  try {
    return await action()
  } finally {
    useAppStore.getState().camera.setPhase('idle')
  }
}
export async function exportTake(
  take: Take,
  kinds: OutputKind[],
  anotherCopy = false
): Promise<ExportResult[]> {
  if (useAppStore.getState().camera.phase !== 'idle') throw new Error('Recorder is busy')
  useAppStore.getState().camera.setPhase('exporting')
  const results: ExportResult[] = []
  let current = useAppStore.getState().projects.takes.find((item) => item.id === take.id) ?? take
  const revision = current.trim ? `${current.trim.start}:${current.trim.end}` : 'original'
  try {
    if (anotherCopy) {
      current = {
        ...current,
        exports: current.exports.filter(
          (receipt) => receipt.revision !== revision || !kinds.includes(receipt.kind)
        ),
      }
      await saveTake(current)
    }
    for (const kind of kinds) {
      const existing = current.exports.find(
        (receipt) => receipt.kind === kind && receipt.revision === revision
      )
      if (existing) {
        results.push({ kind, assetId: existing.assetId })
        continue
      }
      try {
        const file = videoFile(current, kind)
        if (Paths.availableDiskSpace < file.size * (current.trim ? 2 : 1) + 32 * 1024 * 1024)
          throw new Error('Not enough space to export; original is safe')
        const assetId = await NativeRecorder.exportVideo(
          file.uri,
          current.trim?.start ?? -1,
          current.trim?.end ?? -1
        )
        current = { ...current, exports: [...current.exports, { kind, revision, assetId }] }
        // Update MMKV immediately; still remember the saved asset if its disk receipt fails.
        useAppStore.getState().projects.putTake(current)
        await saveTake(current)
        results.push({ kind, assetId })
      } catch (error) {
        results.push({ kind, error: error instanceof Error ? error.message : String(error) })
      }
    }
  } finally {
    useAppStore.getState().camera.setPhase('idle')
  }
  return results
}
