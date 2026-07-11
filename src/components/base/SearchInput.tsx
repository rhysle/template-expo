import { XCircleIcon } from 'phosphor-react-native'
import { useRef } from 'react'
import {
  Pressable,
  type StyleProp,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

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
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const inputRef = useRef<TextInput>(null)

  const canEdit = editable !== false && readOnly !== true
  const showClearButton = canEdit && Boolean(value?.length)

  const handleClear = () => {
    inputRef.current?.clear()
    onChangeText?.('')
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        readOnly={readOnly}
        style={styles.input}
        placeholderTextColor={colors.text.muted}
        returnKeyType="search"
        underlineColorAndroid="transparent"
        {...props}
      />
      {showClearButton ? (
        <Pressable
          accessibilityLabel={clearAccessibilityLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={handleClear}
          style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}>
          <XCircleIcon size={iconSizes.md} color={colors.text.muted} weight="fill" />
        </Pressable>
      ) : null}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    alignItems: 'center',
    backgroundColor: t.colors.background.card,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.background.surface,
    flexDirection: 'row',
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
  },
  input: {
    color: t.colors.text.primary,
    flex: 1,
    fontSize: t.typography.sizes.lg,
    paddingVertical: t.spacing.xs,
  },
  clearButton: {
    marginLeft: t.spacing.sm,
  },
  clearButtonPressed: {
    opacity: 0.65,
  },
}))
