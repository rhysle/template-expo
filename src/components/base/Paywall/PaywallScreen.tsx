import * as WebBrowser from 'expo-web-browser'
import { XIcon } from 'phosphor-react-native'
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
import { AnalyticsGeneralEvents, trackEvent } from '@/services/firebase/analytics'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { PackageOption } from './PackageOption'
import { PaywallFeatureRow } from './PaywallFeatureRow'
import { PaywallHero } from './PaywallHero'
import { computeYearlySavingsPercent } from './savings'
import type { PaywallScreenProps } from './types'
import { usePaywall } from './usePaywall'

export const PaywallScreen = ({
  title,
  subtitle,
  features,
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
  const {
    packages,
    selectedPackage,
    setSelectedPackage,
    loading,
    purchasing,
    handleSubscribe,
    handleRestore,
  } = usePaywall({
    onComplete,
    onSubscribeSuccess,
    onSubscribeError,
    onRestoreSuccess,
    onRestoreNoSubscription,
    onRestoreError,
  })

  const hasFreeTrialSelected = selectedPackage?.product.introPrice?.price === 0

  useEffect(() => {
    trackEvent(AnalyticsGeneralEvents.PAYWALL_VIEWED)
  }, [])

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <SpinArcLoader color={colors.text.accent} size={36} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Pressable
        style={[styles.closeButton, { top: insets.top + 8 }]}
        onPress={() => {
          trackEvent(AnalyticsGeneralEvents.PAYWALL_DISMISSED)
          onDismiss?.()
        }}
        disabled={purchasing}
        hitSlop={12}>
        <XIcon size={iconSizes.lg} color={colors.text.muted} />
      </Pressable>

      <FadeScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(400)}>
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

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <View style={styles.featuresContainer}>
            {features.map((feature) => (
              <PaywallFeatureRow key={feature.title} feature={feature} />
            ))}
          </View>
        </Animated.View>
      </FadeScrollView>

      {packages.length > 0 ? (
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.packagesContainer}>
          {packages.map((pkg, index) => (
            <PackageOption
              key={pkg.identifier}
              pkg={pkg}
              selected={selectedPackage?.identifier === pkg.identifier}
              onSelect={setSelectedPackage}
              index={index}
              savingsPercent={computeYearlySavingsPercent(pkg, packages)}
            />
          ))}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.footer}>
        <Button
          variant="primary"
          size="lg"
          label={hasFreeTrialSelected ? t('paywall.ctaFreeTrial') : t('paywall.cta')}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.colors.background.base,
  },
  closeButton: {
    position: 'absolute',
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
  featuresContainer: {
    marginBottom: t.spacing['2xl'],
  },
  packagesContainer: {
    paddingHorizontal: t.spacing['2xl'],
    gap: t.spacing.md,
  },
  footer: {
    paddingHorizontal: t.spacing['2xl'],
    paddingTop: t.spacing['2xl'],
    paddingBottom: t.spacing.sm,
    gap: t.spacing.sm,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: t.spacing.md,
    gap: t.spacing.sm,
  },
}))
