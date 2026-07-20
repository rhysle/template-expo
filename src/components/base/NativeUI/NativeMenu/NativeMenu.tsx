import { type MenuAction, MenuView } from '@expo/ui/community/menu'

import type { NativeMenuAction, NativeMenuProps } from './NativeMenu.types'

const mapAction = (action: NativeMenuAction): MenuAction => ({
  id: action.id,
  title: action.label,
  attributes:
    action.disabled || action.destructive
      ? {
          disabled: action.disabled,
          destructive: action.destructive,
        }
      : undefined,
  state: action.selected === undefined ? undefined : action.selected ? 'on' : 'off',
  subactions: action.children?.map(mapAction),
})

export const NativeMenu = ({
  actions,
  onSelect,
  children,
  title,
  trigger = 'press',
  style,
  testID,
}: NativeMenuProps) => (
  <MenuView
    actions={actions.map(mapAction)}
    title={title}
    shouldOpenOnLongPress={trigger === 'longPress'}
    style={style}
    testID={testID}
    onPressAction={({ nativeEvent }) => onSelect(nativeEvent.event)}>
    {children}
  </MenuView>
)
