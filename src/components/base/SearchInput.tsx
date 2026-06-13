import { type StyleProp, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

export interface SearchInputProps extends Omit<TextInputProps, 'style'> {
  containerStyle?: StyleProp<ViewStyle>
}

export const SearchInput = ({ containerStyle, ...props }: SearchInputProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.text.muted}
        returnKeyType="search"
        {...props}
      />
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    backgroundColor: t.colors.background.card,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.background.surface,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
  },
  input: {
    color: t.colors.text.primary,
    fontSize: t.typography.sizes.lg,
  },
}))
