import { XCircleIcon } from 'phosphor-react-native'
import { useEffect, useRef, useState } from 'react'
import {
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'

import { iconSizes, useTheme } from '@/theme'

import { Pressable } from './Pressable'
import { TextField } from './TextField'

export interface SearchInputProps extends Omit<
  TextInputProps,
  'style' | 'clearButtonMode' | 'defaultValue'
> {
  containerStyle?: StyleProp<ViewStyle>
  clearAccessibilityLabel?: string
}

export const SearchInput = ({
  containerStyle,
  clearAccessibilityLabel = 'Clear search text',
  value,
  onChangeText,
  editable,
  readOnly,
  cursorColor,
  selectionHandleColor,
  ...props
}: SearchInputProps) => {
  const { colors } = useTheme()
  const inputRef = useRef<TextInput>(null)
  const [internalValue, setInternalValue] = useState(value ?? '')

  useEffect(() => {
    if (value !== undefined) setInternalValue(value)
  }, [value])

  const canEdit = editable !== false && readOnly !== true
  const showClearButton = canEdit && internalValue.length > 0

  const handleChangeText = (nextValue: string) => {
    setInternalValue(nextValue)
    onChangeText?.(nextValue)
  }

  const handleClear = () => {
    inputRef.current?.clear()
    setInternalValue('')
    onChangeText?.('')
    inputRef.current?.focus()
  }

  return (
    <TextField
      ref={inputRef}
      value={value}
      onChangeText={handleChangeText}
      editable={editable}
      readOnly={readOnly}
      cursorColor={cursorColor ?? colors.primary.main}
      selectionHandleColor={selectionHandleColor ?? colors.primary.main}
      containerStyle={containerStyle}
      returnKeyType="search"
      trailing={
        showClearButton ? (
          <Pressable
            accessibilityLabel={clearAccessibilityLabel}
            accessibilityRole="button"
            activeOpacity={0.65}
            hitSlop={12}
            onPress={handleClear}
            style={styles.clearButton}>
            <XCircleIcon size={iconSizes.md} color={colors.text.muted} weight="fill" />
          </Pressable>
        ) : null
      }
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  clearButton: {
    zIndex: 1,
  },
})
