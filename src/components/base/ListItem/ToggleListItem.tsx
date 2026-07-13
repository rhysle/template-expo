import { Toggle, type ToggleProps } from '../Toggle'
import { ListItem, type ListItemProps } from './ListItem'
import { ListItemInfo } from './ListItemInfo'
import type { ListItemInfoProps } from './types'

export interface ToggleListItemProps
  extends
    Omit<ListItemProps, 'children' | 'left' | 'right' | 'onPress'>,
    Pick<ToggleProps, 'disabled' | 'haptic' | 'onValueChange' | 'value'>,
    ListItemInfoProps {}

export const ToggleListItem = ({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
  haptic = true,
  ...listItemProps
}: ToggleListItemProps) => (
  <ListItem
    {...listItemProps}
    left={<ListItemInfo icon={icon} title={title} subtitle={subtitle} />}
    right={
      <Toggle value={value} onValueChange={onValueChange} disabled={disabled} haptic={haptic} />
    }
  />
)
