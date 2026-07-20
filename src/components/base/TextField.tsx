import type { ReactNode } from 'react'
import { forwardRef, useState } from 'react'
import {
  type StyleProp,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'

import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { Text } from './Text'

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string
  helperText?: string
  errorText?: string
  leading?: ReactNode
  trailing?: ReactNode
  containerStyle?: StyleProp<ViewStyle>
  fieldStyle?: StyleProp<ViewStyle>
  style?: StyleProp<TextStyle>
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    {
      label,
      helperText,
      errorText,
      leading,
      trailing,
      containerStyle,
      fieldStyle,
      style,
      editable,
      readOnly,
      multiline,
      accessibilityLabel,
      accessibilityHint,
      accessibilityState,
      placeholderTextColor,
      cursorColor,
      selectionHandleColor,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme()
    const styles = useThemedStyles(createStyles)
    const [isFocused, setIsFocused] = useState(false)
    const isDisabled = editable === false
    const canEdit = !isDisabled && readOnly !== true
    const supportingText = errorText ?? helperText

    const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
      setIsFocused(true)
      onFocus?.(event)
    }

    const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
      setIsFocused(false)
      onBlur?.(event)
    }

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? (
          <Text variant="caption" weight="semibold">
            {label}
          </Text>
        ) : null}

        <View
          style={[
            styles.field,
            isFocused && canEdit && styles.fieldFocused,
            errorText && styles.fieldError,
            !canEdit && styles.fieldReadOnly,
            fieldStyle,
          ]}>
          {leading ? <View style={styles.adornment}>{leading}</View> : null}

          <TextInput
            ref={ref}
            accessibilityHint={accessibilityHint ?? supportingText}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{
              ...accessibilityState,
              disabled: isDisabled || accessibilityState?.disabled,
            }}
            aria-invalid={Boolean(errorText)}
            editable={editable}
            multiline={multiline}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholderTextColor={placeholderTextColor ?? colors.text.muted}
            cursorColor={cursorColor ?? colors.primary.main}
            selectionHandleColor={selectionHandleColor ?? colors.primary.main}
            readOnly={readOnly}
            style={[
              styles.input,
              multiline && styles.inputMultiline,
              !canEdit && styles.inputReadOnly,
              style,
            ]}
            underlineColorAndroid="transparent"
            {...props}
          />

          {trailing ?? null}
        </View>

        {supportingText ? (
          <Text
            variant="caption"
            tone={errorText ? 'error' : 'muted'}
            accessibilityLiveRegion={errorText ? 'polite' : 'none'}
            selectable>
            {supportingText}
          </Text>
        ) : null}
      </View>
    )
  }
)

TextField.displayName = 'TextField'

const createStyles = createThemedStyles((t) => ({
  container: {
    width: '100%',
    gap: t.spacing.sm,
  },
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    backgroundColor: t.colors.background.card,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.border.default,
    paddingHorizontal: t.spacing.md,
  },
  fieldFocused: {
    borderColor: t.colors.primary.main,
    borderWidth: 2,
    paddingHorizontal: t.spacing.md - 1,
  },
  fieldError: {
    borderColor: t.colors.status.error,
  },
  fieldReadOnly: {
    backgroundColor: t.colors.background.subtle,
  },
  input: {
    minWidth: 0,
    minHeight: 48,
    flex: 1,
    color: t.colors.text.primary,
    fontFamily: t.typography.fontFamily.regular,
    fontSize: t.typography.sizes.lg,
    fontWeight: t.typography.weights.regular,
    paddingVertical: t.spacing.sm,
  },
  inputMultiline: {
    minHeight: 112,
    paddingVertical: t.spacing.md,
    textAlignVertical: 'top',
  },
  inputReadOnly: {
    color: t.colors.text.muted,
  },
  adornment: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
