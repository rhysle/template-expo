import {
  EarIcon,
  GaugeIcon,
  type Icon,
  LockKeyIcon,
  SlidersHorizontalIcon,
  SpeakerHighIcon,
  WarningCircleIcon,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'

import { Card, Text } from '@/components/base'
import { createThemedStyles, iconSizes, useCommonStyles, useTheme, useThemedStyles } from '@/theme'

export default function AudioSafetyScreen() {
  const { t } = useTranslation()
  const theme = useTheme()
  const commonStyles = useCommonStyles()
  const styles = useThemedStyles(createStyles)

  const sections: { icon: Icon; title: string; body: string }[] = [
    {
      icon: EarIcon,
      title: t('audioTools.safety.playbackTitle'),
      body: t('audioTools.safety.playbackBody'),
    },
    {
      icon: SpeakerHighIcon,
      title: t('audioTools.safety.routingTitle'),
      body: t('audioTools.safety.routingBody'),
    },
    {
      icon: GaugeIcon,
      title: t('audioTools.safety.estimateTitle'),
      body: t('audioTools.safety.estimateBody'),
    },
    {
      icon: SlidersHorizontalIcon,
      title: t('audioTools.safety.calibrationTitle'),
      body: t('audioTools.safety.calibrationBody'),
    },
    {
      icon: LockKeyIcon,
      title: t('audioTools.safety.privacyTitle'),
      body: t('audioTools.safety.privacyBody'),
    },
    {
      icon: WarningCircleIcon,
      title: t('audioTools.safety.limitationsTitle'),
      body: t('audioTools.safety.limitationsBody'),
    },
  ]

  return (
    <ScrollView
      style={commonStyles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <Text variant="subtitle" tone="secondary">
        {t('audioTools.safety.intro')}
      </Text>

      {sections.map(({ icon: SectionIcon, title, body }, index) => (
        <Card key={title} style={styles.card}>
          <View
            style={[
              styles.icon,
              index === sections.length - 1 ? styles.warningIcon : styles.infoIcon,
            ]}>
            <SectionIcon
              size={iconSizes.lg}
              color={
                index === sections.length - 1
                  ? theme.colors.status.warning
                  : theme.colors.primary.main
              }
              weight="bold"
            />
          </View>
          <View style={styles.content}>
            <Text variant="subtitle" weight="semibold">
              {title}
            </Text>
            <Text variant="body" tone="secondary" selectable>
              {body}
            </Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: t.spacing.lg,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing['4xl'],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.full,
  },
  infoIcon: {
    backgroundColor: t.colors.primary.soft,
  },
  warningIcon: {
    backgroundColor: t.colors.background.subtle,
  },
  content: {
    minWidth: 0,
    flex: 1,
    gap: t.spacing.sm,
  },
}))
