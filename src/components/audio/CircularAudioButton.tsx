import { PlayIcon, StopIcon } from 'phosphor-react-native'
import { ActivityIndicator, type StyleProp, View, type ViewStyle } from 'react-native'

import { Pressable } from '@/components/base'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

interface CircularAudioButtonProps {
  active: boolean
  accessibilityLabel: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  haptic?: boolean
  style?: StyleProp<ViewStyle>
}

export const CircularAudioButton = ({
  active,
  accessibilityLabel,
  onPress,
  loading = false,
  disabled = false,
  haptic = true,
  style,
}: CircularAudioButtonProps) => {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <View style={[styles.halo, active && styles.haloActive, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled }}
        disabled={disabled || loading}
        haptic={haptic}
        hapticType="medium"
        onPress={onPress}
        style={[styles.button, active && styles.buttonActive]}>
        {loading ? (
          <ActivityIndicator color={theme.colors.text.inverse} />
        ) : active ? (
          <StopIcon size={iconSizes.xl} color={theme.colors.text.inverse} weight="fill" />
        ) : (
          <PlayIcon size={iconSizes.xl} color={theme.colors.text.inverse} weight="fill" />
        )}
      </Pressable>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  halo: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: withAlpha(t.colors.primary.main, 0.1),
  },
  haloActive: {
    backgroundColor: withAlpha(t.colors.status.error, 0.1),
  },
  button: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.main,
    ...t.shadows.lg,
  },
  buttonActive: {
    backgroundColor: t.colors.status.error,
  },
}))
