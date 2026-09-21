import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

interface ProjectsSelectionContextValue {
  registerDeleteAction: (action: (() => void) | null) => void
  requestDelete: () => void
  selectedMediaIds: Set<string>
  selectionMode: boolean
  setSelectedMediaIds: Dispatch<SetStateAction<Set<string>>>
  setSelectionMode: (value: boolean) => void
}

const ProjectsSelectionContext = createContext<ProjectsSelectionContextValue | null>(null)

export function ProjectsSelectionProvider({ children }: { children: ReactNode }) {
  const [selectionMode, setSelectionModeState] = useState(false)
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(() => new Set())
  const deleteAction = useRef<(() => void) | null>(null)
  const setSelectionMode = useCallback((value: boolean) => {
    setSelectionModeState(value)
    if (!value) setSelectedMediaIds(new Set())
  }, [])
  const registerDeleteAction = useCallback((action: (() => void) | null) => {
    deleteAction.current = action
  }, [])
  const requestDelete = useCallback(() => deleteAction.current?.(), [])
  const value = useMemo(
    () => ({
      registerDeleteAction,
      requestDelete,
      selectedMediaIds,
      selectionMode,
      setSelectedMediaIds,
      setSelectionMode,
    }),
    [registerDeleteAction, requestDelete, selectedMediaIds, selectionMode, setSelectionMode]
  )

  return (
    <ProjectsSelectionContext.Provider value={value}>{children}</ProjectsSelectionContext.Provider>
  )
}

export function useProjectsSelection() {
  const value = useContext(ProjectsSelectionContext)
  if (!value) throw new Error('useProjectsSelection must be used inside ProjectsSelectionProvider.')
  return value
}
