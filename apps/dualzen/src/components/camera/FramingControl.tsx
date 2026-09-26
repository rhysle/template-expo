import { withAlpha } from '@shared/core/utils/color'
import { BlurView } from 'expo-blur'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, StyleSheet, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import type { OutputKind } from '@/services/camera/types'
import { useCameraState } from '@/stores/features/camera'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { CameraOptionSegmentedControl, CameraOptionSlider } from './CameraOptionControls'

export function FramingControl({
  landscape,
  portraitCropPosition,
  landscapeGuidePosition,
}: {
  landscape: boolean
  portraitCropPosition: SharedValue<number>
  landscapeGuidePosition: SharedValue<number>
}) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const { sharedSettings: settings, phase, updateSharedSettings } = useCameraState()
  const [kind, setKind] = useState<OutputKind>('portrait')
  const storedValue = kind === 'portrait' ? settings.portraitPosition : settings.landscapePosition
  const [sliderValue, setSliderValue] = useState(storedValue)
  const pendingPosition = useRef<{ kind: OutputKind; value: number } | null>(null)
  useEffect(() => {
    setSliderValue(storedValue)
  }, [storedValue])
  const changePosition = (value: number) => {
    pendingPosition.current = { kind, value }
    if (Platform.OS === 'ios') setSliderValue(value)
    if (kind === 'landscape') {
      landscapeGuidePosition.set(value)
    } else {
      portraitCropPosition.set(value)
    }
  }
  const finishPositionChange = (value?: number) => {
    const pending = value === undefined ? pendingPosition.current : { kind, value }
    if (!pending) return
    pendingPosition.current = null
    updateSharedSettings(
      pending.kind === 'portrait'
        ? { portraitPosition: pending.value }
        : { landscapePosition: pending.value }
    )
  }
  const label = t('camera.crop', { kind: t(`camera.${kind}`) })
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[styles.popover, landscape && styles.popoverLandscape]}>
      <BlurView
        tint={theme.appearance}
        intensity={50}
        pointerEvents="none"
        style={styles.popoverBlur}
      />
      <View style={styles.popoverContent}>
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
          value={sliderValue}
          liveValue={kind === 'portrait' ? portraitCropPosition : landscapeGuidePosition}
          onValueChange={changePosition}
          onValueChangeFinished={finishPositionChange}
        />
      </View>
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
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: withAlpha(theme.colors.background.surface, 0.45),
  },
  popoverBlur: StyleSheet.absoluteFill,
  popoverContent: { gap: theme.spacing.lg },
  popoverLandscape: {
    left: undefined,
    right: theme.spacing.sm,
    bottom: '50%',
    width: theme.spacing['9xl'] * 2 + theme.spacing['8xl'] - theme.spacing.sm * 2,
    marginBottom: theme.spacing['7xl'] / 2 + theme.spacing.sm,
  },
  segmentedControl: { width: '100%' },
}))
