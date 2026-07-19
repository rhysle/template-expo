import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { TAB_BAR_HEIGHT } from '@/constants/layout'

export type TabNavigatorMode = 'custom' | 'native'

interface TabBarHeightContextValue {
  accessoryHeight: number
  height: number
  mode: TabNavigatorMode
  setAccessoryHeight: (h: number) => void
  setHeight: (h: number) => void
  setMode: (mode: TabNavigatorMode) => void
}

const TabBarHeightContext = createContext<TabBarHeightContextValue>({
  accessoryHeight: 0,
  height: TAB_BAR_HEIGHT,
  mode: 'native',
  setAccessoryHeight: () => {},
  setHeight: () => {},
  setMode: () => {},
})

export const TabBarHeightProvider = ({ children }: { children: ReactNode }) => {
  const [accessoryHeight, setAccessoryHeight] = useState(0)
  const [height, setHeight] = useState(TAB_BAR_HEIGHT)
  const [mode, setMode] = useState<TabNavigatorMode>('native')
  return (
    <TabBarHeightContext.Provider
      value={{ accessoryHeight, height, mode, setAccessoryHeight, setHeight, setMode }}>
      {children}
    </TabBarHeightContext.Provider>
  )
}

export const useRegisterTabNavigator = (mode: TabNavigatorMode) => {
  const { setMode } = useContext(TabBarHeightContext)

  useEffect(() => {
    setMode(mode)
    return () => setMode('native')
  }, [mode, setMode])
}

export const useTabBarHeight = () => {
  const { accessoryHeight, height, mode } = useContext(TabBarHeightContext)
  const tabBarHeight = mode === 'custom' ? height : TAB_BAR_HEIGHT
  return tabBarHeight + accessoryHeight
}

export const useTabBarContentInset = () => {
  const { height, mode } = useContext(TabBarHeightContext)
  const insets = useSafeAreaInsets()

  if (mode === 'custom') return height
  return process.env.EXPO_OS === 'ios' ? insets.bottom : 0
}

export const useSetTabBarHeight = () => useContext(TabBarHeightContext).setHeight
export const useSetTabBarAccessoryHeight = () => useContext(TabBarHeightContext).setAccessoryHeight
