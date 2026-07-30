import { PlayIcon, StopIcon } from 'phosphor-react-native'
import { ActivityIndicator, type StyleProp, View, type ViewStyle } from 'react-native'

import { Pressable } from '@/components/base'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'
import { withAlpha } from '@/utils/color'

interface CircularAudioButtonProps {
  active: boolean
  accessibilityLabel: string
  onPress: () => void
  size?: 'default' | 'large'
  loading?: boolean
  disabled?: boolean
  haptic?: boolean
  style?: StyleProp<ViewStyle>
}

export const CircularAudioButton = ({
  active,
  accessibilityLabel,
  onPress,
  size = 'default',
  loading = false,
  disabled = false,
  haptic = true,
  style,
}: CircularAudioButtonProps) => {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const isLarge = size === 'large'

  return (
    <View style={[styles.halo, isLarge && styles.haloLarge, active && styles.haloActive, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled }}
        disabled={disabled || loading}
        haptic={haptic}
        hapticType="medium"
        onPress={onPress}
        style={[styles.button, isLarge && styles.buttonLarge, active && styles.buttonActive]}>
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
  haloLarge: {
    width: 152,
    height: 152,
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
  buttonLarge: {
    width: 124,
    height: 124,
  },
}))
