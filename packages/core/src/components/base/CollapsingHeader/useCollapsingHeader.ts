import { Platform } from 'react-native'
import {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const COMPACT_BAR_HEIGHT = 44
const DEFAULT_THRESHOLD = 60

export interface UseCollapsingHeaderOptions {
  threshold?: number
  /**
   * When true, automatically normalises the scroll offset for scroll views that use
   * `contentInset.top = headerHeight` on iOS (e.g. `DraggableFlatList`).
   * The hook applies `headerHeight` as the inset correction on iOS and 0 on other platforms.
   * Use this instead of `contentContainerStyle.paddingTop` on iOS so that
   * `UIRefreshControl` appears within the inset zone (below the safe area / notch).
   */
  headerInset?: boolean
}

export const useCollapsingHeader = ({
  threshold = DEFAULT_THRESHOLD,
  headerInset = false,
}: UseCollapsingHeaderOptions = {}) => {
  const insets = useSafeAreaInsets()
  const headerHeight = insets.top + COMPACT_BAR_HEIGHT
  const contentInsetTop = headerInset && Platform.OS === 'ios' ? headerHeight : 0

  const scrollOffset = useSharedValue(0)

  const largeTitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollOffset.value, [0, threshold], [1, 0], Extrapolation.CLAMP),
  }))

  // For DraggableFlatList.onScrollOffsetChange (JS thread)
  const onScrollOffsetChange = (offset: number) => {
    scrollOffset.value = offset + contentInsetTop
  }

  // For Animated.ScrollView.onScroll (UI thread)
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollOffset.value = event.contentOffset.y + contentInsetTop
  })

  return {
    scrollOffset,
    largeTitleAnimatedStyle,
    onScrollOffsetChange,
    scrollHandler,
    headerHeight,
  }
}
