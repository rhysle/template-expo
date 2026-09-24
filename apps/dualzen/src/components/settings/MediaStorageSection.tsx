import { Card, IconButton, Text } from '@shared/core/components/base'
import { recordError } from '@shared/core/services/sentry'
import { useSnackbarState } from '@shared/core/stores/features/snackbar'
import { TrashIcon } from 'phosphor-react-native'
import { type ComponentProps, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform, View } from 'react-native'

import { clearAllProjects, mutateProjects } from '@/services/camera/projects'
import { AnalyticsAppEvents, trackEvent } from '@/services/firebase/analytics'
import { useCameraState } from '@/stores/features/camera'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

const MAX_ANALYTICS_COUNT = 999

function DestructiveTrashIcon(props: ComponentProps<typeof TrashIcon>) {
  const { colors } = useTheme()
  return <TrashIcon {...props} color={colors.status.error} />
}

export function MediaStorageSection() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { phase } = useCameraState()
  const { showSnackbar } = useSnackbarState()
  const [clearing, setClearing] = useState(false)

  const clearMedia = async () => {
    if (clearing || phase !== 'idle') return
    setClearing(true)

    try {
      const result = await mutateProjects(clearAllProjects)
      trackEvent(AnalyticsAppEvents.PROJECTS_CLEARED, {
        media_count: Math.min(result.mediaCount, MAX_ANALYTICS_COUNT),
        project_count: Math.min(result.projectCount, MAX_ANALYTICS_COUNT),
      })
      showSnackbar({ title: t('settings.clearMediaSuccess'), variant: 'success' })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (message === 'Camera is busy') {
        showSnackbar({ title: t('settings.clearMediaBusy'), variant: 'error' })
        return
      }

      recordError(cause, 'projects.clearAll', {
        platform: Platform.OS,
        stage: 'filesystem_cleanup',
      })
      trackEvent(AnalyticsAppEvents.PROJECTS_CLEAR_FAILED, { stage: 'filesystem_cleanup' })
      showSnackbar({ title: t('settings.clearMediaFailure'), variant: 'error' })
    } finally {
      setClearing(false)
    }
  }

  const confirmClearMedia = () => {
    Alert.alert(t('settings.clearMediaConfirmTitle'), t('settings.clearMediaConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.clearMediaButton'),
        style: 'destructive',
        onPress: () => void clearMedia(),
      },
    ])
  }

  return (
    <View style={styles.section}>
      <Text variant="subtitle" weight="semibold" tone="accent" style={styles.sectionTitle}>
        {t('settings.mediaStorage')}
      </Text>
      <Card padding="none">
        <View style={styles.actionRow}>
          <View style={styles.actionText}>
            <Text variant="subtitle" weight="medium">
              {t('settings.clearMediaButton')}
            </Text>
            <Text variant="caption" tone="muted">
              {t('settings.mediaStorageBody')}
            </Text>
          </View>
          <IconButton
            accessibilityLabel={t('settings.clearMediaButton')}
            disabled={phase !== 'idle' || clearing}
            hitSlop={8}
            icon={DestructiveTrashIcon}
            loading={clearing}
            onPress={confirmClearMedia}
            size="md"
            variant="ghost"
          />
        </View>
      </Card>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  section: { marginVertical: t.spacing.xl },
  sectionTitle: {
    marginBottom: t.spacing.xl,
    textTransform: 'uppercase',
  },
  actionRow: {
    minHeight: t.spacing['5xl'],
    paddingStart: t.spacing.xl,
    paddingEnd: t.spacing.md,
    paddingVertical: t.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.lg,
  },
  actionText: { flex: 1, gap: t.spacing.xs },
}))
