import type { BottomTabBarProps } from 'expo-router/js-tabs'

import { CapsuleNavigationBar } from './CapsuleNavigationBar'

export interface CapsuleTabBarProps extends BottomTabBarProps {
  disabled?: boolean
  hideOnKeyboard?: boolean
}

/** A measured, icon-only floating tab bar with a spring interaction on the whole capsule. */
export const CapsuleTabBar = ({
  state,
  descriptors,
  navigation,
  disabled = false,
  hideOnKeyboard = true,
}: CapsuleTabBarProps) => (
  <CapsuleNavigationBar
    hideOnKeyboard={hideOnKeyboard}
    items={state.routes.map((route, index) => {
      const options = descriptors[route.key].options
      const focused = state.index === index
      return {
        key: route.key,
        label: options.tabBarAccessibilityLabel ?? options.title ?? route.name,
        selected: focused,
        disabled: disabled && !focused,
        renderIcon: (color, size) => options.tabBarIcon?.({ focused, color, size }),
        testID: options.tabBarButtonTestID,
        onPress: () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!focused && !disabled && !event.defaultPrevented) navigation.navigate(route.name)
        },
        onLongPress: () => navigation.emit({ type: 'tabLongPress', target: route.key }),
      }
    })}
  />
)
