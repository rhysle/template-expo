import { QuestionIcon } from 'phosphor-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { EjectHelpSheet } from '@/components/audio/EjectHelpSheet'
import { Pressable, TabStack } from '@/components/base'
import { HistoryHeaderButton } from '@/components/HistoryHeaderButton'
import { SettingsHeaderButton } from '@/components/SettingsHeaderButton'
import { usePreventInterstitialAd } from '@/services/ads'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

export default function EjectTabLayout() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const [helpVisible, setHelpVisible] = useState(false)
  usePreventInterstitialAd('eject_help', helpVisible)

  return (
    <>
      <TabStack
        title={t('tabs.eject')}
        headerRight={() => (
          <View style={styles.actions}>
            <HistoryHeaderButton initialKind="cleaning" />
            <Pressable
              accessibilityLabel={t('audioTools.eject.help.title')}
              accessibilityRole="button"
              accessibilityState={{ expanded: helpVisible }}
              haptic
              hitSlop={8}
              onPress={() => setHelpVisible(true)}>
              <QuestionIcon size={iconSizes.lg} color={colors.text.primary} weight="bold" />
            </Pressable>
            <SettingsHeaderButton />
          </View>
        )}
      />

      <EjectHelpSheet visible={helpVisible} onDismiss={() => setHelpVisible(false)} />
    </>
  )
}

const createStyles = createThemedStyles((t) => ({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.lg,
    paddingHorizontal: t.spacing.sm,
  },
}))
