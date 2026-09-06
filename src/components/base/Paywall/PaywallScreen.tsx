import * as WebBrowser from 'expo-web-browser'
import { CheckIcon, XIcon } from 'phosphor-react-native'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/base/Button'
import { FadeScrollView } from '@/components/base/FadeScrollView'
import { SpinArcLoader } from '@/components/base/Loader'
import { Text } from '@/components/base/Text'
import { AppConfig } from '@/configs'
import { TABLET_CONTENT_MAX_WIDTH } from '@/constants/layout'
import { AnalyticsGeneralEvents, trackEvent } from '@/services/firebase/analytics'
import { useAdsState } from '@/stores/features/ads'
import { usePaywallState } from '@/stores/features/paywall'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { PackageOption } from './PackageOption'
import { PaywallComparisonTable } from './PaywallComparisonTable'
import { PaywallHero } from './PaywallHero'
import { computeYearlySavingsPercent } from './savings'
import type { PaywallScreenProps } from './types'
import { usePaywall } from './usePaywall'

const ENTER_ANIMATION_DURATION_MS = 600

export const PaywallScreen = ({
  title,
  subtitle,
  comparisonItems,
  source,
  onComplete,
  onDismiss,
  onSubscribeSuccess,
  onSubscribeError,
  onRestoreSuccess,
  onRestoreNoSubscription,
  onRestoreError,
}: PaywallScreenProps) => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { setPaywallShowing } = usePaywallState()
  const { setInterstitialAdPrevented } = useAdsState()
  const {
    packages,
    selectedPackage,
    setSelectedPackage,
    offeringsStatus,
    retryOfferings,
    purchasing,
    handleSubscribe,
    handleRestore,
  } = usePaywall({
    source,
    onComplete,
    onSubscribeSuccess,
    onSubscribeError,
    onRestoreSuccess,
    onRestoreNoSubscription,
    onRestoreError,
  })

  const hasFreeTrialSelected = selectedPackage?.product.introPrice?.price === 0
  const isLifetimeSelected = selectedPackage?.packageType === 'LIFETIME'
  const purchaseDisclaimer = selectedPackage
    ? isLifetimeSelected
      ? t('paywall.lifetimeDisclaimer')
      : hasFreeTrialSelected
        ? t('paywall.trialDisclaimer')
        : t('paywall.subscriptionDisclaimer')
    : null
  const offeringsNotice =
    offeringsStatus === 'purchase_not_allowed'
      ? {
          title: t('paywall.availability.purchase_not_allowed.title'),
          subtitle: t('paywall.availability.purchase_not_allowed.subtitle'),
        }
      : offeringsStatus === 'temporary_error'
        ? {
            title: t('paywall.availability.temporary_error.title'),
            subtitle: t('paywall.availability.temporary_error.subtitle'),
          }
        : {
            title: t('paywall.availability.configuration_error.title'),
            subtitle: t('paywall.availability.configuration_error.subtitle'),
          }

  useEffect(() => {
    setPaywallShowing(true)
    setInterstitialAdPrevented('paywall', true)
    trackEvent(AnalyticsGeneralEvents.PAYWALL_VIEWED, { source })
    return () => {
      setPaywallShowing(false)
      setInterstitialAdPrevented('paywall', false)
    }
  }, [setInterstitialAdPrevented, setPaywallShowing, source])

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Pressable
        style={[styles.closeButton, { top: insets.top + 8 }]}
        onPress={() => {
          trackEvent(AnalyticsGeneralEvents.PAYWALL_DISMISSED, { source })
          onDismiss?.()
        }}
        disabled={purchasing}
        hitSlop={12}>
        <XIcon size={iconSizes.lg} color={colors.text.muted} />
      </Pressable>

      <FadeScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(ENTER_ANIMATION_DURATION_MS)}>
          <View style={styles.heroContainer}>
            <PaywallHero />
          </View>
          <View style={styles.header}>
            <Text variant="title" weight="bold" align="center">
              {title}
            </Text>
            <Text variant="subtitle" tone="secondary" align="center">
              {subtitle}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(ENTER_ANIMATION_DURATION_MS).delay(100)}>
          <View style={styles.comparisonContainer}>
            <PaywallComparisonTable items={comparisonItems} />
          </View>
        </Animated.View>
      </FadeScrollView>

      <Animated.View
        entering={FadeInDown.duration(ENTER_ANIMATION_DURATION_MS).delay(200)}
        style={styles.packagesContainer}>
        {offeringsStatus === 'loading' ? (
          <View style={styles.offeringsLoading} accessibilityLiveRegion="polite">
            <SpinArcLoader color={colors.text.accent} />
            <Text variant="caption" tone="secondary" align="center">
              {t('paywall.availability.loading')}
            </Text>
          </View>
        ) : offeringsStatus === 'available' ? (
          packages.map((pkg, index) => (
            <PackageOption
              key={pkg.identifier}
              pkg={pkg}
              selected={selectedPackage?.identifier === pkg.identifier}
              onSelect={setSelectedPackage}
              index={index}
              savingsPercent={computeYearlySavingsPercent(pkg, packages)}
            />
          ))
        ) : (
          <View style={styles.offeringsNotice} accessibilityLiveRegion="polite">
            <View style={styles.offeringsNoticeCopy}>
              <Text variant="label" weight="semibold" align="center">
                {offeringsNotice.title}
              </Text>
              <Text variant="caption" tone="secondary" align="center">
                {offeringsNotice.subtitle}
              </Text>
            </View>
            {offeringsStatus !== 'purchase_not_allowed' ? (
              <Button
                variant="outlined"
                size="sm"
                label={t('common.retry')}
                onPress={retryOfferings}
              />
            ) : null}
          </View>
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(ENTER_ANIMATION_DURATION_MS).delay(300)}
        style={styles.footer}>
        <View style={[styles.purchaseDisclaimer, !purchaseDisclaimer && styles.disclaimerHidden]}>
          <CheckIcon aria-hidden size={iconSizes.sm} color={colors.text.muted} weight="bold" />
          <Text variant="caption" tone="muted" align="center" aria-hidden={!purchaseDisclaimer}>
            {purchaseDisclaimer}
          </Text>
        </View>
        <Button
          variant="primary"
          size="lg"
          label={hasFreeTrialSelected ? t('paywall.ctaFreeTrial') : t('common.continue')}
          haptic
          fullWidth
          loading={purchasing}
          disabled={purchasing || !selectedPackage}
          onPress={handleSubscribe}
        />
        <View style={styles.legalLinks}>
          <Pressable
            hitSlop={12}
            onPress={() => WebBrowser.openBrowserAsync(AppConfig.links.termsOfService)}>
            <Text variant="caption" tone="muted">
              {t('paywall.terms')}
            </Text>
          </Pressable>
          <Text variant="caption" tone="muted">
            ·
          </Text>
          <Pressable
            hitSlop={12}
            onPress={() => WebBrowser.openBrowserAsync(AppConfig.links.privacyPolicy)}>
            <Text variant="caption" tone="muted">
              {t('paywall.privacy')}
            </Text>
          </Pressable>
          <Text variant="caption" tone="muted">
            ·
          </Text>
          <Pressable hitSlop={12} disabled={purchasing} onPress={handleRestore}>
            <Text variant="caption" tone="muted">
              {t('paywall.restore')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.background.base,
  },
  closeButton: {
    position: 'absolute',
    opacity: 0.5,
    left: t.spacing.lg,
    zIndex: 10,
    padding: t.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: t.spacing['2xl'],
    paddingTop: t.spacing['3xl'],
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: t.spacing['2xl'],
  },
  header: {
    gap: t.spacing.sm,
    marginBottom: t.spacing['3xl'],
  },
  comparisonContainer: {
    width: '100%',
    maxWidth: TABLET_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    marginBottom: t.spacing['2xl'],
  },
  packagesContainer: {
    width: '100%',
    maxWidth: TABLET_CONTENT_MAX_WIDTH + t.spacing['2xl'] * 2,
    alignSelf: 'center',
    paddingHorizontal: t.spacing['2xl'],
    gap: t.spacing.sm,
  },
  offeringsLoading: {
    minHeight: t.spacing['8xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
  offeringsNotice: {
    minHeight: t.spacing['8xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
    borderRadius: t.borderRadius.lg,
  },
  offeringsNoticeCopy: {
    gap: t.spacing.xs,
  },
  footer: {
    width: '100%',
    maxWidth: TABLET_CONTENT_MAX_WIDTH + t.spacing['2xl'] * 2,
    alignSelf: 'center',
    paddingHorizontal: t.spacing['2xl'],
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.sm,
    gap: t.spacing.sm,
  },
  purchaseDisclaimer: {
    minHeight: t.typography.sizes.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
  },
  disclaimerHidden: {
    opacity: 0,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: t.spacing.md,
    gap: t.spacing.sm,
  },
}))
