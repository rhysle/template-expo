import { ActionListItem, Card, Pressable, PromoBanner, Text } from '@shared/core/components/base'
import { getCurrentOtaUpdateId } from '@shared/core/services/otaUpdate'
import { type PaywallSource, usePremiumGate } from '@shared/core/services/revenueCat'
import { recordError } from '@shared/core/services/sentry'
import { openWriteReview } from '@shared/core/services/storeReview'
import { useAdsState } from '@shared/core/stores/features/ads'
import { useSnackbarState } from '@shared/core/stores/features/snackbar'
import { useSubscriptionState } from '@shared/core/stores/features/subscription'
import { useUserIdentityState } from '@shared/core/stores/features/userIdentity'
import { useContactSupport } from '@shared/core/utils/useContactSupport'
import { useShareApp } from '@shared/core/utils/useShareApp'
import * as Clipboard from 'expo-clipboard'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { Stack } from 'expo-router/stack'
import * as WebBrowser from 'expo-web-browser'
import {
  ArrowSquareOutIcon,
  BugIcon,
  CopyIcon,
  CrownIcon,
  EnvelopeIcon,
  FileTextIcon,
  LockIcon,
  ShareNetworkIcon,
  ShieldCheckIcon,
  StarIcon,
} from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { Platform, ScrollView, View } from 'react-native'

import { CameraSettingsSections } from '@/components/camera/CameraSettingsSections'
import { MediaStorageSection } from '@/components/settings/MediaStorageSection'
import { AppConfig } from '@/configs'
import { AdsConsent, isAnyAdFormatEnabled } from '@/services/ads'
import { useCapture } from '@/services/camera/CaptureProvider'
import { AnalyticsGeneralEvents, trackEvent } from '@/services/firebase/analytics'
import { createThemedStyles, iconSizes, useCommonStyles, useTheme, useThemedStyles } from '@/theme'

const SETTINGS_PAYWALL_SOURCE = 'settings' satisfies PaywallSource

export default function SettingsScreen() {
  const recorder = useCapture()
  const { t } = useTranslation()
  const theme = useTheme()
  const commonStyles = useCommonStyles()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { premiumState } = useSubscriptionState()
  const { openPaywall } = usePremiumGate()
  const { userId } = useUserIdentityState()
  const { privacyOptionsRequired } = useAdsState()
  const { showSnackbar } = useSnackbarState()
  const showPrivacyConsentItem =
    isAnyAdFormatEnabled(AppConfig) && premiumState === 'free' && privacyOptionsRequired
  const currentOtaUpdateId = getCurrentOtaUpdateId()
  const appName = Constants.expoConfig?.name ?? 'App'

  const onContactSupportPress = useContactSupport()
  const onSharePress = useShareApp()

  const onRateAppPress = () => {
    trackEvent(AnalyticsGeneralEvents.RATE_APP)
    void openWriteReview(AppConfig)
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
    <View style={commonStyles.container}>
      {Platform.OS === 'ios' && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={t('common.close')}
            icon="xmark"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      )}
      <ScrollView
        style={commonStyles.container}
        contentContainerStyle={[styles.container, { paddingBottom: theme.spacing['3xl'] }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {premiumState === 'free' && (
          <PromoBanner
            icon={<CrownIcon size={iconSizes.lg} color={theme.colors.text.inverse} />}
            title={t('settings.upgradeBanner.title')}
            subtitle={t('settings.upgradeBanner.subtitle')}
            onPress={() => openPaywall(SETTINGS_PAYWALL_SOURCE)}
            style={styles.upgradeBanner}
          />
        )}

        <CameraSettingsSections recorder={recorder} />

        <MediaStorageSection />

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
              withDivider
            />
            <ActionListItem
              onPress={onRateAppPress}
              icon={StarIcon}
              title={t('settings.rateApp')}
              subtitle={t('settings.rateAppSubtitle')}
              withDivider
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
              withDivider
            />
            <ActionListItem
              onPress={handleOpenPrivacyPress}
              icon={LockIcon}
              title={t('paywall.privacy')}
              trailingIcon={ArrowSquareOutIcon}
              withDivider={showPrivacyConsentItem}
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
      </ScrollView>
    </View>
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
