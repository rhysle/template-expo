import { LightningIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Button, NativeBottomSheet, Text } from '@/components/base'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

interface EjectTurboGuideSheetProps {
  visible: boolean
  onConfirm: () => void
  onDismiss: () => void
}

export const EjectTurboGuideSheet = ({
  visible,
  onConfirm,
  onDismiss,
}: EjectTurboGuideSheetProps) => {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const steps = [
    t('audioTools.eject.turbo.guide.frequency'),
    t('audioTools.eject.turbo.guide.duration'),
  ]

  return (
    <NativeBottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.iconSurface}>
            <LightningIcon size={iconSizes.xl} color={colors.primary.main} weight="fill" />
          </View>
          <Text variant="title" weight="bold" align="center" style={styles.title}>
            {t('audioTools.eject.turbo.guide.title')}
          </Text>
          <Text variant="body" tone="secondary" align="center">
            {t('audioTools.eject.turbo.guide.description')}
          </Text>
        </View>

        <View style={styles.stepList}>
          {steps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text variant="caption" weight="bold" tone="accent">
                  {index + 1}
                </Text>
              </View>
              <Text variant="body" tone="secondary" style={styles.stepText}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        <Button
          label={t('audioTools.eject.turbo.guide.cta')}
          fullWidth
          size="lg"
          onPress={onConfirm}
        />
      </View>
    </NativeBottomSheet>
  )
}

const createStyles = createThemedStyles((t) => ({
  content: {
    gap: t.spacing.xl,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  iconSurface: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    borderRadius: t.borderRadius['2xl'],
    backgroundColor: t.colors.primary.soft,
  },
  title: {
    fontSize: t.typography.sizes['2xl'],
  },
  stepList: {
    gap: t.spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.soft,
  },
  stepText: {
    flex: 1,
    paddingTop: 3,
  },
}))
