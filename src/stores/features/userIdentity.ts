import { useShallow } from 'zustand/react/shallow'

import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    userIdentity: UserIdentitySlice
  }
}

export interface UserIdentitySlice {
  userId: string | null
  setUserId: (id: string) => void
  clearUserId: () => void
}

// The dedicated userIdentity MMKV namespace is the source of truth. Keeping this
// runtime slice excluded avoids storing the same UUID in the Zustand snapshot.
export const userIdentityPersistExcludeKeys: ExcludeKeys<UserIdentitySlice> = ['userId']

export const createUserIdentitySlice = (
  set: (updater: (state: UserIdentitySlice) => void) => void
): UserIdentitySlice => ({
  userId: null,
  setUserId: (id) =>
    set((state) => {
      state.userId = id
    }),
  clearUserId: () =>
    set((state) => {
      state.userId = null
    }),
})

export const sliceConfig = {
  create: createUserIdentitySlice,
  persistExcludeKeys: userIdentityPersistExcludeKeys,
} satisfies SliceConfig<UserIdentitySlice>

export const useUserIdentityState = () =>
  getUseAppStore()(
    useShallow(({ userIdentity }) => ({
      userId: userIdentity.userId,
      setUserId: userIdentity.setUserId,
      clearUserId: userIdentity.clearUserId,
    }))
  )
