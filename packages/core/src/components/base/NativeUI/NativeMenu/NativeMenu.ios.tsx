import {
  Button,
  ContextMenu,
  Host,
  Label,
  Menu,
  RNHostView,
  Section,
  Text as SwiftUIText,
  Toggle,
} from '@expo/ui/swift-ui'
import {
  disabled as disabledModifier,
  font,
  tint as tintModifier,
} from '@expo/ui/swift-ui/modifiers'
import { useTheme } from '@shared/core/theme'
import type { ReactElement, ReactNode } from 'react'

import { resolveNativeFontFamily } from '../fontFamily'
import { NativeText } from '../NativeText'
import type { NativeMenuAction, NativeMenuProps } from './NativeMenu.types'

type NativeSystemImage = Extract<NonNullable<NativeMenuAction['image']>, string>

function renderLabel(
  label: string,
  fontFamily?: string,
  systemImage?: NativeSystemImage
): ReactElement {
  const text = (
    <SwiftUIText
      modifiers={
        fontFamily
          ? [font({ family: fontFamily, textStyle: 'body', weight: 'regular' })]
          : undefined
      }>
      {label}
    </SwiftUIText>
  )

  return systemImage ? <Label systemImage={systemImage}>{text}</Label> : text
}

function renderAction(
  action: NativeMenuAction,
  onSelect: (id: string) => void,
  sectionTitle?: string,
  fontFamily?: string
): ReactNode {
  const { children, disabled, destructive, displayInline, image, imageColor, selected, label } =
    action
  const systemImage: NativeSystemImage | undefined = typeof image === 'string' ? image : undefined
  const modifiers = [
    ...(disabled ? [disabledModifier(true)] : []),
    ...(imageColor && (selected !== undefined || !destructive) ? [tintModifier(imageColor)] : []),
    ...(fontFamily ? [font({ family: fontFamily, textStyle: 'body', weight: 'regular' })] : []),
  ]
  const onPress = () => onSelect(action.id)

  if (children && children.length > 0) {
    if (displayInline) {
      return (
        <Section
          key={action.id}
          header={
            sectionTitle ? <NativeText weight="semibold">{sectionTitle}</NativeText> : undefined
          }>
          {children.map((child) => renderAction(child, onSelect, undefined, fontFamily))}
        </Section>
      )
    }
    return (
      <Menu
        key={action.id}
        label={renderLabel(label, fontFamily, systemImage)}
        modifiers={modifiers.length > 0 ? modifiers : undefined}>
        {children.map((child) => renderAction(child, onSelect, undefined, fontFamily))}
      </Menu>
    )
  }

  if (selected !== undefined) {
    return (
      <Toggle
        key={action.id}
        isOn={selected}
        modifiers={modifiers.length > 0 ? modifiers : undefined}
        onIsOnChange={onPress}>
        {renderLabel(label, fontFamily, systemImage)}
      </Toggle>
    )
  }

  return (
    <Button
      key={action.id}
      modifiers={modifiers.length > 0 ? modifiers : undefined}
      onPress={onPress}
      role={destructive ? 'destructive' : undefined}>
      {renderLabel(label, fontFamily, systemImage)}
    </Button>
  )
}

function renderFooter(footer: string): ReactNode {
  return (
    <Button key="native-menu-footer" modifiers={[disabledModifier(true)]}>
      <NativeText textStyle={{ fontSize: 12 }}>{footer}</NativeText>
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
  const { typography } = useTheme()
  const fontFamily = resolveNativeFontFamily(typography.fontFamily.regular, 'regular')
  const firstInlineSectionId = actions.find(
    (action) => action.displayInline && action.children && action.children.length > 0
  )?.id
  const items = actions.map((action) =>
    renderAction(
      action,
      onSelect,
      action.id === firstInlineSectionId ? title : undefined,
      fontFamily
    )
  )
  const menuItems = footer ? [...items, renderFooter(footer)] : items
  const body =
    title && !firstInlineSectionId ? (
      <Section header={<NativeText weight="semibold">{title}</NativeText>}>{menuItems}</Section>
    ) : (
      menuItems
    )
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
