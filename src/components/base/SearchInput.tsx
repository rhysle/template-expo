import { XCircleIcon } from 'phosphor-react-native'
import { useEffect, useRef, useState } from 'react'
import { type StyleProp, TextInput, type TextInputProps, type ViewStyle } from 'react-native'

import { IconButton } from './IconButton'
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
  ...props
}: SearchInputProps) => {
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
  }

  return (
    <TextField
      ref={inputRef}
      value={value}
      onChangeText={handleChangeText}
      editable={editable}
      readOnly={readOnly}
      containerStyle={containerStyle}
      returnKeyType="search"
      trailing={
        showClearButton ? (
          <IconButton
            icon={XCircleIcon}
            iconWeight="fill"
            size="sm"
            variant="ghost"
            haptic={false}
            accessibilityLabel={clearAccessibilityLabel}
            onPress={handleClear}
          />
        ) : null
      }
      {...props}
    />
  )
}
