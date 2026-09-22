import {
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Host,
  Icon,
  RNHostView,
  Text as ComposeText,
  useMaterialColors,
} from '@expo/ui/jetpack-compose'
import * as React from 'react'
import { Pressable, View } from 'react-native'

import type { NativeMenuAction, NativeMenuProps } from './NativeMenu.types'

function buildElementColors(
  action: NativeMenuAction,
  destructiveColor: string
): React.ComponentProps<typeof DropdownMenuItem>['elementColors'] | undefined {
  const isDestructive = action.destructive === true
  if (!isDestructive) return undefined
  return {
    textColor: destructiveColor,
    disabledTextColor: destructiveColor,
    leadingIconColor: destructiveColor,
    disabledLeadingIconColor: destructiveColor,
  }
}

type MenuActionItemProps = {
  action: NativeMenuAction
  onSelect: (id: string) => void
  dismissAll: () => void
  destructiveColor: string
}

function MenuActionItem({ action, onSelect, dismissAll, destructiveColor }: MenuActionItemProps) {
  const [submenuExpanded, setSubmenuExpanded] = React.useState(false)
  const { children, disabled, image, imageColor, label, selected } = action
  const leadingIconSource = typeof image === 'string' || image == null ? null : image
  const elementColors = buildElementColors(action, destructiveColor)

  if (children && children.length > 0) {
    return (
      <DropdownMenu expanded={submenuExpanded} onDismissRequest={() => setSubmenuExpanded(false)}>
        <DropdownMenu.Trigger>
          <DropdownMenuItem
            enabled={!disabled}
            elementColors={elementColors}
            onClick={() => setSubmenuExpanded(true)}>
            <DropdownMenuItem.Text>
              <ComposeText>{label}</ComposeText>
            </DropdownMenuItem.Text>
            {leadingIconSource && (
              <DropdownMenuItem.LeadingIcon>
                <Icon source={leadingIconSource} size={24} tint={imageColor} />
              </DropdownMenuItem.LeadingIcon>
            )}
          </DropdownMenuItem>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {children.map((child) => (
            <MenuActionItem
              key={child.id}
              action={child}
              onSelect={onSelect}
              dismissAll={() => {
                setSubmenuExpanded(false)
                dismissAll()
              }}
              destructiveColor={destructiveColor}
            />
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenuItem
      enabled={!disabled}
      elementColors={elementColors}
      onClick={() => {
        onSelect(action.id)
        dismissAll()
      }}>
      <DropdownMenuItem.Text>
        <ComposeText>{label}</ComposeText>
      </DropdownMenuItem.Text>
      {leadingIconSource && (
        <DropdownMenuItem.LeadingIcon>
          <Icon source={leadingIconSource} size={24} tint={imageColor} />
        </DropdownMenuItem.LeadingIcon>
      )}
      {selected === true && (
        <DropdownMenuItem.TrailingIcon>
          <ComposeText>✓</ComposeText>
        </DropdownMenuItem.TrailingIcon>
      )}
    </DropdownMenuItem>
  )
}

function MenuFooter({ footer }: { footer: string }) {
  return (
    <DropdownMenuItem enabled={false}>
      <DropdownMenuItem.Text>
        <ComposeText style={{ typography: 'labelSmall' }}>{footer}</ComposeText>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>
  )
}

export function NativeMenu({
  actions,
  children,
  footer,
  onSelect,
  trigger = 'press',
  style,
  testID,
}: NativeMenuProps) {
  const [expanded, setExpanded] = React.useState(false)
  const expandedRef = React.useRef(false)
  const destructiveColor = useMaterialColors().error

  const open = React.useCallback(() => {
    if (expandedRef.current) return
    expandedRef.current = true
    setExpanded(true)
  }, [])
  const dismissAll = React.useCallback(() => {
    if (!expandedRef.current) return
    expandedRef.current = false
    setExpanded(false)
  }, [])

  return (
    <View style={style} testID={testID}>
      <Host matchContents>
        <DropdownMenu expanded={expanded} onDismissRequest={dismissAll}>
          <DropdownMenu.Trigger>
            <RNHostView matchContents>
              <Pressable
                onPress={trigger === 'longPress' ? undefined : open}
                onLongPress={trigger === 'longPress' ? open : undefined}
                android_disableSound
                focusable={false}
                accessible={false}>
                {children}
              </Pressable>
            </RNHostView>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>
            {actions.map((action, index) => {
              const inlineChildren = action.displayInline ? action.children : undefined
              if (inlineChildren && inlineChildren.length > 0) {
                return (
                  <React.Fragment key={action.id}>
                    {index > 0 && <HorizontalDivider />}
                    {inlineChildren.map((child) => (
                      <MenuActionItem
                        key={child.id}
                        action={child}
                        onSelect={onSelect}
                        dismissAll={dismissAll}
                        destructiveColor={destructiveColor}
                      />
                    ))}
                  </React.Fragment>
                )
              }
              return (
                <MenuActionItem
                  key={action.id}
                  action={action}
                  onSelect={onSelect}
                  dismissAll={dismissAll}
                  destructiveColor={destructiveColor}
                />
              )
            })}
            {footer ? <MenuFooter footer={footer} /> : null}
          </DropdownMenu.Items>
        </DropdownMenu>
      </Host>
    </View>
  )
}
