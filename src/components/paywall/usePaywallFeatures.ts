import {
  ClockCounterClockwiseIcon,
  DropIcon,
  GaugeIcon,
  LightningIcon,
  ProhibitIcon,
  SpeakerHifiIcon,
  WaveformIcon,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import type { PaywallComparisonItem, PaywallComparisonValue } from '@/components/base/Paywall'
import { useActivityHistory } from '@/services/activity'

interface PaywallHeaderContent {
  title: string
  subtitle: string
}

const included = { type: 'included' } satisfies PaywallComparisonValue
const excluded = { type: 'excluded' } satisfies PaywallComparisonValue

const useComparisonRows = () => {
  const { t } = useTranslation()

  return {
    cleaningDuration: {
      id: 'cleaning-duration',
      icon: DropIcon,
      title: t('paywall.comparison.rows.cleaningDuration.title'),
      free: { type: 'text', text: t('paywall.comparison.rows.cleaningDuration.free') },
      pro: { type: 'text', text: t('paywall.comparison.rows.cleaningDuration.pro') },
    },
    turbo: {
      id: 'turbo-clear-wave',
      icon: LightningIcon,
      title: t('paywall.comparison.rows.turbo.title'),
      free: excluded,
      pro: included,
    },
    waveforms: {
      id: 'tone-waveforms',
      icon: WaveformIcon,
      title: t('paywall.comparison.rows.waveforms.title'),
      free: { type: 'text', text: t('paywall.comparison.rows.waveforms.free') },
      pro: { type: 'text', text: t('paywall.comparison.rows.waveforms.pro') },
    },
    stereoTesting: {
      id: 'stereo-testing',
      icon: SpeakerHifiIcon,
      title: t('paywall.comparison.rows.stereoTesting.title'),
      free: { type: 'text', text: t('paywall.comparison.rows.stereoTesting.free') },
      pro: { type: 'text', text: t('paywall.comparison.rows.stereoTesting.pro') },
    },
    soundInsights: {
      id: 'sound-insights',
      icon: GaugeIcon,
      title: t('paywall.comparison.rows.soundInsights.title'),
      free: { type: 'text', text: t('paywall.comparison.rows.soundInsights.free') },
      pro: { type: 'text', text: t('paywall.comparison.rows.soundInsights.pro') },
    },
    activityHistory: {
      id: 'activity-history',
      icon: ClockCounterClockwiseIcon,
      title: t('paywall.comparison.rows.activityHistory.title'),
      free: excluded,
      pro: included,
    },
    adExperience: {
      id: 'ad-experience',
      icon: ProhibitIcon,
      title: t('paywall.comparison.rows.adExperience.title'),
      free: { type: 'text', text: t('paywall.comparison.rows.adExperience.free') },
      pro: { type: 'text', text: t('paywall.comparison.rows.adExperience.pro') },
    },
  } satisfies Record<string, PaywallComparisonItem>
}

export const usePaywallComparison = (): PaywallComparisonItem[] => {
  const rows = useComparisonRows()

  return [
    rows.turbo,
    rows.activityHistory,
    rows.cleaningDuration,
    rows.waveforms,
    rows.soundInsights,
    rows.stereoTesting,
    rows.adExperience,
  ]
}

export const useContextualPaywallContent = (source: string): PaywallHeaderContent => {
  const { t } = useTranslation()
  const { counts } = useActivityHistory()

  if (source === 'history') {
    return {
      title: t('paywall.context.historyTitle'),
      subtitle: t('paywall.context.historySubtitle', {
        cleaning: counts.cleaning,
        db: counts.db,
      }),
    }
  }

  if (source.startsWith('eject_')) {
    return {
      title: t('paywall.title'),
      subtitle: t('paywall.context.cleaningSubtitle'),
    }
  }

  if (source === 'db_advanced') {
    return {
      title: t('paywall.title'),
      subtitle: t('paywall.context.dbSubtitle'),
    }
  }

  return {
    title: t('paywall.title'),
    subtitle: t('paywall.subtitle'),
  }
}
