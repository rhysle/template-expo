import type { SliceConfig } from '@shared/core/stores/slices/types'
import { useShallow } from 'zustand/react/shallow'

import { DEFAULT_PROJECT_ID, type Project, type Take } from '@/services/camera/types'

import { getUseAppStore } from '../slices/types'

interface ProjectsSlice {
  projects: Project[]
  takes: Take[]
  selectedProjectId: string
  selectProject: (id: string) => void
  putProject: (project: Project) => void
  removeProject: (id: string) => void
  putTake: (take: Take) => void
  removeTake: (id: string) => void
}
declare global {
  interface AppSlices {
    projects: ProjectsSlice
  }
}
export const sliceConfig = {
  create: (set: (updater: (state: ProjectsSlice) => void) => void): ProjectsSlice => ({
    projects: [{ id: DEFAULT_PROJECT_ID, name: null, createdAt: 0 }],
    takes: [],
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
        state.takes = state.takes.filter((take) => take.projectId !== id)
        if (state.selectedProjectId === id) state.selectedProjectId = DEFAULT_PROJECT_ID
      }),
    putTake: (take) =>
      set((state) => {
        const index = state.takes.findIndex((item) => item.id === take.id)
        if (index < 0) state.takes.unshift(take)
        else state.takes[index] = take
      }),
    removeTake: (id) =>
      set((state) => {
        state.takes = state.takes.filter((take) => take.id !== id)
      }),
  }),
  persistExcludeKeys: [],
} satisfies SliceConfig<ProjectsSlice>
export const useProjectsState = () =>
  getUseAppStore()(useShallow((state) => ({ ...state.projects })))
