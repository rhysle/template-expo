import { IconButton, Slider, Text } from '@shared/core/components/base'
import { withAlpha } from '@shared/core/utils/color'
import { XIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { useCameraState } from '@/stores/features/camera'
import { createThemedStyles, useThemedStyles } from '@/theme'

export function FramingControl({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { settings, phase, updateSettings } = useCameraState()
  const label = t('camera.crop', { kind: t('camera.landscape') })
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={styles.popover}>
      <View style={styles.header}>
        <Text variant="label" weight="semibold">
          {label}
        </Text>
        <IconButton icon={XIcon} accessibilityLabel={t('camera.done')} onPress={onClose} />
      </View>
      <Slider
        accessibilityLabel={label}
        disabled={phase !== 'idle'}
        value={settings.landscapePosition}
        onValueChange={(value) => updateSettings({ landscapePosition: value })}
      />
    </Animated.View>
  )
}
const createStyles = createThemedStyles((theme) => ({
  popover: {
    position: 'absolute',
    bottom: theme.spacing['7xl'] + theme.spacing.sm * 2,
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    zIndex: 3,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: withAlpha(theme.colors.background.surface, 0.95),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
}))
