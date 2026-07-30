import * as Clipboard from 'expo-clipboard'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import {
  ArrowSquareOutIcon,
  BugIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  CrownIcon,
  EnvelopeIcon,
  FileTextIcon,
  LockIcon,
  ShareNetworkIcon,
  ShieldCheckIcon,
  StarIcon,
  TrashIcon,
  VibrateIcon,
} from 'phosphor-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'

import {
  ActionListItem,
  Card,
  NativeAlertDialog,
  Pressable,
  PromoBanner,
  Text,
  ToggleListItem,
} from '@/components/base'
import { AppConfig } from '@/configs'
import { clearActivityHistory, useActivityHistory } from '@/services/activity'
import { AdsConsent, isAnyAdFormatEnabled } from '@/services/ads'
import {
  AnalyticsAppEvents,
  AnalyticsGeneralEvents,
  trackEvent,
} from '@/services/firebase/analytics'
import { getCurrentOtaUpdateId } from '@/services/otaUpdate'
import { type PaywallSource, usePremiumGate } from '@/services/revenueCat'
import { recordError } from '@/services/sentry'
import { openWriteReview } from '@/services/storeReview'
import { useAdsState } from '@/stores/features/ads'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { useSnackbarState } from '@/stores/features/snackbar'
import { useSubscriptionState } from '@/stores/features/subscription'
import { useUserIdentityState } from '@/stores/features/userIdentity'
import { createThemedStyles, iconSizes, useCommonStyles, useTheme, useThemedStyles } from '@/theme'
import { useContactSupport } from '@/utils/useContactSupport'
import { useShareApp } from '@/utils/useShareApp'

const SETTINGS_PAYWALL_SOURCE = 'settings' satisfies PaywallSource

export default function SettingsScreen() {
  const { t } = useTranslation()
  const theme = useTheme()
  const commonStyles = useCommonStyles()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { premiumState } = useSubscriptionState()
  const { openPaywall } = usePremiumGate()
  const { hapticsEnabled, setHapticsEnabled } = useAudioPreferencesState()
  const { userId } = useUserIdentityState()
  const { privacyOptionsRequired } = useAdsState()
  const { showSnackbar } = useSnackbarState()
  const { counts } = useActivityHistory()
  const [clearHistoryVisible, setClearHistoryVisible] = useState(false)
  const showPrivacyConsentItem =
    isAnyAdFormatEnabled() && premiumState === 'free' && privacyOptionsRequired
  const currentOtaUpdateId = getCurrentOtaUpdateId()
  const appName = Constants.expoConfig?.name ?? 'App'

  const onContactSupportPress = useContactSupport()
  const onSharePress = useShareApp()

  const onRateAppPress = () => {
    trackEvent(AnalyticsGeneralEvents.RATE_APP)
    void openWriteReview()
  }

  const handleOpenTermsPress = () => {
    void WebBrowser.openBrowserAsync(AppConfig.links.termsOfService)
  }

  const handleOpenPrivacyPress = () => {
    void WebBrowser.openBrowserAsync(AppConfig.links.privacyPolicy)
  }

  const handlePrivacyConsentPress = () => {
    void AdsConsent.showPrivacyOptionsForm().catch((error) =>
      recordError(error, 'handlePrivacyConsentPress')
    )
  }

  const handleCopyUserId = () => {
    if (!userId) return
    void Clipboard.setStringAsync(userId).then(() => {
      showSnackbar({ title: t('settings.userIdCopied'), variant: 'success' })
    })
  }

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <Text variant="subtitle" tone="secondary" style={styles.subtitle}>
        {t('settings.subtitle')}
      </Text>

      {premiumState === 'free' && (
        <PromoBanner
          icon={<CrownIcon size={iconSizes.lg} color={theme.colors.text.inverse} />}
          title={t('settings.upgradeBanner.title')}
          subtitle={t('settings.upgradeBanner.subtitle')}
          onPress={() => openPaywall(SETTINGS_PAYWALL_SOURCE)}
          style={styles.upgradeBanner}
        />
      )}

      <View style={styles.section}>
        <Text variant="subtitle" weight="semibold" tone="accent" style={styles.sectionTitle}>
          {t('settings.audio.section')}
        </Text>
        <Card padding="none">
          <ToggleListItem
            icon={VibrateIcon}
            title={t('settings.audio.haptics')}
            subtitle={t('settings.audio.hapticsSubtitle')}
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
          />
          <ActionListItem
            onPress={() => router.push('/audio-safety' as never)}
            icon={ShieldCheckIcon}
            title={t('settings.audio.safety')}
            subtitle={t('settings.audio.safetySubtitle')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="subtitle" weight="semibold" tone="accent" style={styles.sectionTitle}>
          {t('settings.activity.section')}
        </Text>
        <Card padding="none">
          <ActionListItem
            onPress={() => {
              if (premiumState === 'premium') router.push('/activity-history')
              else if (premiumState === 'free') {
                trackEvent(AnalyticsAppEvents.HISTORY_LOCKED_VIEWED, { source: 'settings' })
                openPaywall('history')
              }
            }}
            icon={ClockCounterClockwiseIcon}
            title={t('settings.activity.saved')}
            subtitle={t('activity.savedCount', {
              cleaning: counts.cleaning,
              db: counts.db,
            })}
          />
          <ActionListItem
            onPress={() => setClearHistoryVisible(true)}
            icon={TrashIcon}
            title={t('settings.activity.clear')}
            subtitle={t('settings.activity.clearSubtitle')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="subtitle" weight="semibold" tone="accent" style={styles.sectionTitle}>
          {t('settings.support')}
        </Text>
        <Card padding="none">
          <ActionListItem
            onPress={onContactSupportPress}
            icon={EnvelopeIcon}
            title={t('settings.contactSupport')}
            subtitle={t('settings.contactSupportSubtitle')}
          />
          <ActionListItem
            onPress={onRateAppPress}
            icon={StarIcon}
            title={t('settings.rateApp')}
            subtitle={t('settings.rateAppSubtitle')}
          />
          <ActionListItem
            onPress={onSharePress}
            icon={ShareNetworkIcon}
            title={t('settings.shareApp')}
            subtitle={t('settings.shareAppSubtitle')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="subtitle" weight="semibold" tone="accent" style={styles.sectionTitle}>
          {t('settings.legalSection')}
        </Text>
        <Card padding="none">
          <ActionListItem
            onPress={handleOpenTermsPress}
            icon={FileTextIcon}
            title={t('paywall.terms')}
            trailingIcon={ArrowSquareOutIcon}
          />
          <ActionListItem
            onPress={handleOpenPrivacyPress}
            icon={LockIcon}
            title={t('paywall.privacy')}
            trailingIcon={ArrowSquareOutIcon}
          />
          {showPrivacyConsentItem && (
            <ActionListItem
              onPress={handlePrivacyConsentPress}
              icon={ShieldCheckIcon}
              title={t('settings.privacyConsent')}
            />
          )}
        </Card>
      </View>

      <View style={styles.aboutCard}>
        <Text variant="subtitle" weight="semibold">
          {appName}
        </Text>
        <Text variant="body" tone="secondary" style={styles.appVersion}>
          {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
        {currentOtaUpdateId !== null && (
          <Text variant="caption" tone="muted" style={styles.otaUpdateId}>
            {t('settings.otaUpdateId', { updateId: currentOtaUpdateId.slice(0, 8) })}
          </Text>
        )}
        <Pressable onPress={handleCopyUserId} style={styles.userIdRow}>
          <Text variant="caption" tone="muted">
            {t('settings.userId')}:{' '}
          </Text>
          <Text variant="caption" tone="muted" style={styles.userIdValue}>
            {userId ? `${userId.slice(0, 8)}...${userId.slice(-4)}` : '-'}
          </Text>
          <CopyIcon
            size={iconSizes.xs}
            color={theme.colors.text.muted}
            style={styles.userIdCopyIcon}
          />
        </Pressable>
      </View>
      {__DEV__ && (
        <View style={styles.section}>
          <Text variant="subtitle" weight="semibold" tone="accent" style={styles.sectionTitle}>
            Developer
          </Text>
          <Card padding="none">
            <ActionListItem
              onPress={() => router.push('/debug' as never)}
              icon={BugIcon}
              title="Debug State"
            />
          </Card>
        </View>
      )}
      <NativeAlertDialog
        visible={clearHistoryVisible}
        title={t('settings.activity.clearConfirmTitle')}
        message={t('settings.activity.clearConfirmBody')}
        confirmAction={{
          label: t('settings.activity.clear'),
          role: 'destructive',
          onPress: () => {
            clearActivityHistory()
            setClearHistoryVisible(false)
            showSnackbar({ title: t('settings.activity.cleared'), variant: 'success' })
          },
        }}
        dismissAction={{
          label: t('common.cancel'),
          role: 'cancel',
          onPress: () => setClearHistoryVisible(false),
        }}
        onDismiss={() => setClearHistoryVisible(false)}
      />
    </ScrollView>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing['3xl'],
  },
  subtitle: {
    marginBottom: t.spacing.xl,
  },
  section: {
    marginVertical: t.spacing.xl,
  },
  upgradeBanner: {
    marginBottom: t.spacing.xl,
  },
  sectionTitle: {
    marginBottom: t.spacing.xl,
    textTransform: 'uppercase',
  },
  aboutCard: {
    marginVertical: t.spacing.xl,
    alignItems: 'center',
  },
  userIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: t.spacing.md,
  },
  userIdValue: {
    fontFamily: 'monospace',
  },
  userIdCopyIcon: {
    marginLeft: t.spacing.xs,
  },
  appVersion: {
    marginBottom: t.spacing.xs,
    marginTop: t.spacing.xs,
  },
  otaUpdateId: {
    marginBottom: t.spacing.md,
  },
}))
