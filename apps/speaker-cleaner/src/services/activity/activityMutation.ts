import type { PersistedActivityState } from './activityValidation'
import type { ActivityRecordReference } from './types'

export const removeActivityRecordsFromState = (
  state: PersistedActivityState,
  records: readonly ActivityRecordReference[]
): PersistedActivityState => {
  const cleaningIds = new Set<string>()
  const dbIds = new Set<string>()

  records.forEach(({ id, kind }) => {
    if (kind === 'cleaning') cleaningIds.add(id)
    else dbIds.add(id)
  })

  const cleaning =
    cleaningIds.size === 0
      ? state.cleaning
      : state.cleaning.filter(({ id }) => !cleaningIds.has(id))
  const db = dbIds.size === 0 ? state.db : state.db.filter(({ id }) => !dbIds.has(id))

  if (cleaning.length === state.cleaning.length && db.length === state.db.length) return state

  return { ...state, cleaning, db }
}
