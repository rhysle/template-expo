import {
  Button,
  ContextMenu,
  Host,
  Menu,
  RNHostView,
  Section,
  Text as NativeText,
  Toggle,
} from '@expo/ui/swift-ui'
import {
  disabled as disabledModifier,
  font,
  tint as tintModifier,
} from '@expo/ui/swift-ui/modifiers'
import type { ReactNode } from 'react'

import type { NativeMenuAction, NativeMenuProps } from './NativeMenu.types'

function renderAction(action: NativeMenuAction, onSelect: (id: string) => void): ReactNode {
  const { children, disabled, destructive, image, imageColor, selected, label } = action
  const systemImage = typeof image === 'string' ? image : undefined
  const modifiers = [
    ...(disabled ? [disabledModifier(true)] : []),
    ...(imageColor && (selected !== undefined || !destructive) ? [tintModifier(imageColor)] : []),
  ]
  const onPress = () => onSelect(action.id)

  if (children && children.length > 0) {
    return (
      <Menu key={action.id} label={label} systemImage={systemImage} modifiers={modifiers}>
        {children.map((child) => renderAction(child, onSelect))}
      </Menu>
    )
  }

  if (selected !== undefined) {
    return (
      <Toggle
        key={action.id}
        isOn={selected}
        label={label}
        modifiers={modifiers.length > 0 ? modifiers : undefined}
        systemImage={systemImage}
        onIsOnChange={onPress}
      />
    )
  }

  return (
    <Button
      key={action.id}
      label={label}
      modifiers={modifiers.length > 0 ? modifiers : undefined}
      onPress={onPress}
      role={destructive ? 'destructive' : undefined}
      systemImage={systemImage}
    />
  )
}

function renderFooter(footer: string): ReactNode {
  return (
    <Button key="native-menu-footer" modifiers={[disabledModifier(true)]}>
      <NativeText modifiers={[font({ textStyle: 'caption2' })]}>{footer}</NativeText>
    </Button>
  )
}

export const NativeMenu = ({
  actions,
  children,
  footer,
  onSelect,
  title,
  trigger = 'press',
  style,
  testID,
}: NativeMenuProps) => {
  const items = actions.map((action) => renderAction(action, onSelect))
  const menuItems = footer ? [...items, renderFooter(footer)] : items
  const body = title ? <Section title={title}>{menuItems}</Section> : menuItems
  const triggerView = (
    <RNHostView matchContents>
      <>{children}</>
    </RNHostView>
  )

  return (
    <Host matchContents style={style} testID={testID} ignoreSafeArea="all">
      {trigger === 'longPress' ? (
        <ContextMenu>
          <ContextMenu.Trigger>{triggerView}</ContextMenu.Trigger>
          <ContextMenu.Items>{body}</ContextMenu.Items>
        </ContextMenu>
      ) : (
        <Menu label={triggerView}>{body}</Menu>
      )}
    </Host>
  )
}
