import { CaretRightIcon, type Icon } from 'phosphor-react-native'

import { useIsRTL } from '@/services/rtl'
import { iconSizes, useTheme } from '@/theme'

import { ListItem, type ListItemProps } from './ListItem'
import { ListItemInfo } from './ListItemInfo'
import type { ListItemInfoProps } from './types'

export interface ActionListItemProps
  extends Omit<ListItemProps, 'children' | 'left' | 'right'>, ListItemInfoProps {
  trailingIcon?: Icon
}

export const ActionListItem = ({
  icon,
  title,
  subtitle,
  trailingIcon: TrailingIcon = CaretRightIcon,
  ...listItemProps
}: ActionListItemProps) => {
  const { colors } = useTheme()
  const isRTL = useIsRTL()

  return (
    <ListItem
      {...listItemProps}
      left={<ListItemInfo icon={icon} title={title} subtitle={subtitle} />}
      right={
        <TrailingIcon
          size={iconSizes.sm}
          color={colors.text.muted}
          style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
        />
      }
    />
  )
}
