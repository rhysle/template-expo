import { CaretRightIcon, CheckIcon } from 'phosphor-react-native'
import { useState } from 'react'
import { View } from 'react-native'

import { useIsRTL } from '@/services/rtl'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { BottomSheet } from '../BottomSheet'
import { Text } from '../Text'
import { ListItem, type ListItemProps } from './ListItem'
import { ListItemInfo } from './ListItemInfo'
import type { ListItemInfoProps } from './types'

export interface SelectListItemProps<T>
  extends Omit<ListItemProps, 'children' | 'left' | 'onPress' | 'right'>, ListItemInfoProps {
  value: T
  options: T[]
  onChange: (value: T) => void
  sheetTitle: string
  renderLabel?: (value: T) => string
}

export const SelectListItem = <T extends string | number | boolean>({
  icon,
  title,
  subtitle,
  value,
  options,
  onChange,
  sheetTitle,
  renderLabel = String,
  ...listItemProps
}: SelectListItemProps<T>) => {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const [sheetVisible, setSheetVisible] = useState(false)
  const isRTL = useIsRTL()

  return (
    <>
      <ListItem
        {...listItemProps}
        onPress={() => setSheetVisible(true)}
        left={<ListItemInfo icon={icon} title={title} subtitle={subtitle} />}
        right={
          <View style={styles.triggerRight}>
            <Text variant="body" tone="secondary" style={styles.valueText}>
              {renderLabel(value)}
            </Text>
            <CaretRightIcon
              size={iconSizes.sm}
              color={colors.text.muted}
              style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
            />
          </View>
        }
      />

      <BottomSheet visible={sheetVisible} onDismiss={() => setSheetVisible(false)}>
        <Text variant="subtitle" weight="semibold" style={styles.sheetTitle}>
          {sheetTitle}
        </Text>
        {options.map((option, index) => (
          <ListItem
            key={index}
            style={styles.sheetItemContainer}
            onPress={() => {
              onChange(option)
              setSheetVisible(false)
            }}
            left={
              <Text variant="subtitle" weight="medium">
                {renderLabel(option)}
              </Text>
            }
            right={
              option === value ? (
                <CheckIcon size={iconSizes.md} color={colors.primary.main} />
              ) : null
            }
          />
        ))}
      </BottomSheet>
    </>
  )
}

const createStyles = createThemedStyles((t) => ({
  sheetItemContainer: {
    backgroundColor: t.colors.background.surface,
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    marginRight: t.spacing.xs,
  },
  sheetTitle: {
    marginBottom: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
  },
}))
