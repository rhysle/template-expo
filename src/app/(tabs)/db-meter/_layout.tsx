import { QuestionIcon } from 'phosphor-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { DbMeterHelpSheet } from '@/components/audio'
import { Pressable, TabStack } from '@/components/base'
import { SettingsHeaderButton } from '@/components/SettingsHeaderButton'
import { useAudioController } from '@/services/audio'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

export default function DbMeterTabLayout() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const snapshot = useAudioController()
  const [helpVisible, setHelpVisible] = useState(false)
  const [helpReadingDb, setHelpReadingDb] = useState<number | null>(null)

  const openHelp = () => {
    setHelpReadingDb(snapshot.meter.sampleCount > 0 ? Math.round(snapshot.meter.currentDb) : null)
    setHelpVisible(true)
  }

  return (
    <>
      <TabStack
        title={t('tabs.dbMeter')}
        headerRight={() => (
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={t('audioTools.meter.help.title')}
              accessibilityRole="button"
              accessibilityState={{ expanded: helpVisible }}
              haptic
              hitSlop={8}
              onPress={openHelp}>
              <QuestionIcon size={iconSizes.lg} color={colors.text.primary} weight="bold" />
            </Pressable>
            <SettingsHeaderButton />
          </View>
        )}
      />

      <DbMeterHelpSheet
        visible={helpVisible}
        currentDb={helpReadingDb}
        onDismiss={() => setHelpVisible(false)}
      />
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
}))
