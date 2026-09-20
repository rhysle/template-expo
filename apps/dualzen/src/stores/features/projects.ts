import type { SliceConfig } from '@shared/core/stores/slices/types'
import { useShallow } from 'zustand/react/shallow'

import { DEFAULT_PROJECT_ID, type Project, type ProjectMedia } from '@/services/camera/types'

import { getUseAppStore } from '../slices/types'

interface ProjectsSlice {
  projects: Project[]
  media: ProjectMedia[]
  selectedProjectId: string
  selectProject: (id: string) => void
  putProject: (project: Project) => void
  removeProject: (id: string) => void
  putMedia: (media: ProjectMedia) => void
  removeMedia: (id: string) => void
}
declare global {
  interface AppSlices {
    projects: ProjectsSlice
  }
}
export const sliceConfig = {
  create: (set: (updater: (state: ProjectsSlice) => void) => void): ProjectsSlice => ({
    projects: [{ id: DEFAULT_PROJECT_ID, name: null, createdAt: 0 }],
    media: [],
    selectedProjectId: DEFAULT_PROJECT_ID,
    selectProject: (id) =>
      set((state) => {
        if (state.projects.some((project) => project.id === id)) state.selectedProjectId = id
      }),
    putProject: (project) =>
      set((state) => {
        const index = state.projects.findIndex((item) => item.id === project.id)
        if (index < 0) state.projects.push(project)
        else state.projects[index] = project
      }),
    removeProject: (id) =>
      set((state) => {
        if (id === DEFAULT_PROJECT_ID) return
        state.projects = state.projects.filter((project) => project.id !== id)
        state.media = state.media.filter((media) => media.projectId !== id)
        if (state.selectedProjectId === id) state.selectedProjectId = DEFAULT_PROJECT_ID
      }),
    putMedia: (media) =>
      set((state) => {
        const index = state.media.findIndex((item) => item.id === media.id)
        if (index < 0) state.media.unshift(media)
        else state.media[index] = media
      }),
    removeMedia: (id) =>
      set((state) => {
        state.media = state.media.filter((media) => media.id !== id)
      }),
  }),
  persistExcludeKeys: [],
} satisfies SliceConfig<ProjectsSlice>
export const useProjectsState = () =>
  getUseAppStore()(useShallow((state) => ({ ...state.projects })))

export const useLatestLibraryMedia = () =>
  getUseAppStore()((state) =>
    state.projects.media.reduce<ProjectMedia | null>((latest, media) => {
      const hasPortraitExport = media.exports.some((receipt) => receipt.kind === 'portrait')
      if (!hasPortraitExport || (latest && latest.createdAt >= media.createdAt)) return latest
      return media
    }, null)
  )
