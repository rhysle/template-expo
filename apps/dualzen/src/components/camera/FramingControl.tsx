import { withAlpha } from '@shared/core/utils/color'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import type { OutputKind } from '@/services/camera/types'
import { useCameraState } from '@/stores/features/camera'
import { createThemedStyles, useThemedStyles } from '@/theme'

import { CameraOptionSegmentedControl, CameraOptionSlider } from './CameraOptionControls'

export function FramingControl({ landscape }: { landscape: boolean }) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { sharedSettings: settings, phase, updateSharedSettings } = useCameraState()
  const [kind, setKind] = useState<OutputKind>('portrait')
  const label = t('camera.crop', { kind: t(`camera.${kind}`) })
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[styles.popover, landscape && styles.popoverLandscape]}>
      <CameraOptionSegmentedControl
        value={kind}
        options={
          [
            { value: 'portrait', label: t('camera.portrait') },
            { value: 'landscape', label: t('camera.landscape') },
          ] as const
        }
        onValueChange={setKind}
        disabled={phase !== 'idle'}
        style={styles.segmentedControl}
      />
      <CameraOptionSlider
        accessibilityLabel={label}
        disabled={phase !== 'idle'}
        value={kind === 'portrait' ? settings.portraitPosition : settings.landscapePosition}
        onValueChange={(value) =>
          updateSharedSettings(
            kind === 'portrait' ? { portraitPosition: value } : { landscapePosition: value }
          )
        }
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
    zIndex: 6,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: withAlpha(theme.colors.background.surface, 0.95),
  },
  popoverLandscape: {
    left: undefined,
    right: theme.spacing.sm,
    bottom: '50%',
    width: theme.spacing['9xl'] * 2 + theme.spacing['8xl'] - theme.spacing.sm * 2,
    marginBottom: theme.spacing['7xl'] / 2 + theme.spacing.sm,
  },
  segmentedControl: { width: '100%' },
}))
