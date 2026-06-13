import { createContext, type ReactNode, useContext, useState } from 'react'

import { TAB_BAR_HEIGHT } from '@/constants/layout'

interface TabBarHeightContextValue {
  height: number
  setHeight: (h: number) => void
}

const TabBarHeightContext = createContext<TabBarHeightContextValue>({
  height: TAB_BAR_HEIGHT,
  setHeight: () => {},
})

export const TabBarHeightProvider = ({ children }: { children: ReactNode }) => {
  const [height, setHeight] = useState(TAB_BAR_HEIGHT)
  return (
    <TabBarHeightContext.Provider value={{ height, setHeight }}>
      {children}
    </TabBarHeightContext.Provider>
  )
}

export const useTabBarHeight = () => useContext(TabBarHeightContext).height
export const useSetTabBarHeight = () => useContext(TabBarHeightContext).setHeight
