import { QuestionIcon, SpeakerHighIcon } from 'phosphor-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Button, NativeBottomSheet, Pressable, TabStack, Text } from '@/components/base'
import { SettingsHeaderButton } from '@/components/SettingsHeaderButton'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

export default function StereoTestTabLayout() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const [helpVisible, setHelpVisible] = useState(false)
  const guideSteps = [
    t('audioTools.stereo.helpTap'),
    t('audioTools.stereo.helpBoth'),
    t('audioTools.stereo.helpAuto'),
    t('audioTools.stereo.helpStop'),
  ]

  return (
    <>
      <TabStack
        title={t('tabs.stereoTest')}
        headerRight={() => (
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={t('audioTools.stereo.helpTitle')}
              accessibilityRole="button"
              haptic
              hitSlop={8}
              onPress={() => setHelpVisible(true)}>
              <QuestionIcon size={iconSizes.lg} color={colors.text.primary} weight="bold" />
            </Pressable>
            <SettingsHeaderButton />
          </View>
        )}
      />

      <NativeBottomSheet visible={helpVisible} onDismiss={() => setHelpVisible(false)}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetHero}>
            <View style={styles.sheetIcon}>
              <SpeakerHighIcon size={iconSizes.xl} color={colors.primary.main} weight="fill" />
            </View>
            <Text variant="title" weight="bold" align="center" style={styles.sheetTitle}>
              {t('audioTools.stereo.helpTitle')}
            </Text>
          </View>

          <View style={styles.guideList}>
            {guideSteps.map((step, index) => (
              <View key={step} style={styles.guideRow}>
                <View style={styles.guideNumber}>
                  <Text variant="caption" weight="bold" tone="accent">
                    {index + 1}
                  </Text>
                </View>
                <Text variant="body" tone="secondary" style={styles.guideText}>
                  {step}
                </Text>
              </View>
            ))}
          </View>

          <Button label={t('common.done')} fullWidth onPress={() => setHelpVisible(false)} />
        </View>
      </NativeBottomSheet>
    </>
  )
}

const createStyles = createThemedStyles((t) => ({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.lg,
    paddingHorizontal: t.spacing.sm,
  },
  sheetContent: {
    gap: t.spacing.xl,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.md,
  },
  sheetHero: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  sheetIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    borderRadius: t.borderRadius['2xl'],
    backgroundColor: t.colors.primary.soft,
  },
  sheetTitle: {
    fontSize: t.typography.sizes['2xl'],
  },
  guideList: {
    gap: t.spacing.md,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  guideNumber: {
    width: 28,
    height: 28,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.soft,
  },
  guideText: {
    flex: 1,
    paddingTop: 3,
  },
}))
