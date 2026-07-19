import 'react-native-reanimated'

import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { ErrorBoundary, TabBarHeightProvider } from '@/components/base'
import { SnackbarHost } from '@/components/SnackbarHost'
import { I18nProvider } from '@/i18n'
import { useAdsInit } from '@/services/ads'
import { setAnalyticsUserProperties, useScreenTracker } from '@/services/firebase/analytics'
import { useLoadFonts } from '@/services/fonts'
import { useOtaUpdateInit } from '@/services/otaUpdate'
import { QueryProvider } from '@/services/queries'
import { useRevenueCatInit } from '@/services/revenueCat'
import { useRTLSync } from '@/services/rtl'
import { initSentry } from '@/services/sentry'
import { useUserIdentityInit } from '@/services/userIdentity'
import { useOnboardingState } from '@/stores/features/onboarding'
import { useTheme } from '@/theme'

initSentry()
setAnalyticsUserProperties({ app_version: Constants.expoConfig?.version ?? 'unknown' })
void SplashScreen.preventAutoHideAsync()
SplashScreen.setOptions({ fade: true, duration: 250 })

function RootLayoutContent() {
  const { hasCompletedOnboarding } = useOnboardingState()
  const { t } = useTranslation()
  const { appearance, colors, typography } = useTheme()
  const baseNavigationTheme = appearance === 'dark' ? DarkTheme : DefaultTheme
  const navigationTheme = {
    ...baseNavigationTheme,
    colors: {
      ...baseNavigationTheme.colors,
      background: colors.background.base,
      border: colors.border.subtle,
      card: colors.background.card,
      notification: colors.status.error,
      primary: colors.primary.main,
      text: colors.text.primary,
    },
  }
  useScreenTracker()
  useOtaUpdateInit()

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={appearance === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background.base,
          },
          headerShadowVisible: false,
          headerTintColor: colors.text.primary,
          headerTitleStyle: {
            fontFamily: typography.fontFamily.semibold,
            fontWeight: typography.weights.semibold,
            color: colors.text.primary,
          },
          contentStyle: {
            backgroundColor: colors.background.base,
          },
        }}>
        <Stack.Protected guard={hasCompletedOnboarding}>
          {/* iOS needs the back title enabled for headerBackButtonMenuEnabled to work.
              Keep this hidden parent title empty so Settings stays icon-only without exposing "(tabs)". */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
          <Stack.Screen
            name="settings"
            options={{
              title: t('settings.title'),
              headerBackButtonMenuEnabled: false,
              ...(Platform.OS === 'ios'
                ? {
                    headerTransparent: true,
                    headerStyle: { backgroundColor: 'transparent' },
                    headerBlurEffect: 'systemChromeMaterial',
                    // Avoid layering the iOS 26 scroll-edge effect over the native header material.
                    scrollEdgeEffects: { top: 'hidden' as const },
                  }
                : {}),
            }}
          />
          <Stack.Screen
            name="paywall"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          {__DEV__ ? (
            <Stack.Screen
              name="debug"
              options={{
                headerTitle: 'Debug State',
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
          ) : null}
        </Stack.Protected>
        <Stack.Protected guard={!hasCompletedOnboarding}>
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
      <SnackbarHost />
    </ThemeProvider>
  )
}

function RootLayout() {
  const { fontsLoaded, fontError } = useLoadFonts()
  const splashHidden = useRef(false)

  useUserIdentityInit()
  useRevenueCatInit()
  useRTLSync()

  useEffect(() => {
    if ((fontsLoaded || fontError) && !splashHidden.current) {
      splashHidden.current = true
      void SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])

  // If AppConfig.ads.enabled is false, removes this call and run npm run setup:ads to exclude the ads package from autolinking
  // and prevent Metro from bundling it at all.
  useAdsInit()

  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <I18nProvider>
          <ErrorBoundary>
            <TabBarHeightProvider>
              <RootLayoutContent />
            </TabBarHeightProvider>
          </ErrorBoundary>
        </I18nProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  )
}

export default Sentry.wrap(RootLayout)
