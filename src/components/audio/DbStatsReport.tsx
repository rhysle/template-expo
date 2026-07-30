import { useTranslation } from 'react-i18next'
import { type StyleProp, View, type ViewStyle } from 'react-native'

import { Text } from '@/components/base'
import { classifyMeterBand } from '@/services/audio'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

import { getDbMeterBandColors } from './dbMeterBands'

interface DbStatsReportProps {
  minimumDb: number
  averageDb: number
  maximumDb: number
  style?: StyleProp<ViewStyle>
}

export const DbStatsReport = ({ minimumDb, averageDb, maximumDb, style }: DbStatsReportProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const bandColors = getDbMeterBandColors(theme.colors)
  const stats = [
    { label: t('audioTools.meter.minimum'), value: minimumDb },
    { label: t('audioTools.meter.average'), value: averageDb },
    { label: t('audioTools.meter.maximum'), value: maximumDb },
  ]

  return (
    <View style={[styles.container, style]}>
      {stats.map((stat, index) => {
        const valueColor = bandColors[classifyMeterBand(stat.value)]

        return (
          <View key={stat.label} style={[styles.stat, index > 0 && styles.divider]}>
            <Text variant="caption" tone="secondary" align="center">
              {stat.label}
            </Text>
            <Text
              variant="subtitle"
              weight="bold"
              align="center"
              style={[styles.value, { color: valueColor }]}>
              {Math.round(stat.value)} dB
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flexDirection: 'row',
    paddingVertical: t.spacing.sm,
  },
  stat: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  divider: {
    borderStartWidth: 1,
    borderStartColor: t.colors.border.subtle,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
}))
