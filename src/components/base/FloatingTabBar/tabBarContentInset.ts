export type TabNavigatorMode = 'custom' | 'native'

interface TabBarContentInsetOptions {
  accessoryHeight: number
  height: number
  mode: TabNavigatorMode
  nativeFallbackHeight: number
}

export const getTabBarContentInset = ({
  accessoryHeight,
  height,
  mode,
  nativeFallbackHeight,
}: TabBarContentInsetOptions) => {
  const tabBarHeight = mode === 'custom' ? height : nativeFallbackHeight
  return tabBarHeight + accessoryHeight
}
