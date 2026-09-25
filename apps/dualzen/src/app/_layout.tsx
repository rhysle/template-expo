import 'react-native-reanimated'

import * as Sentry from '@sentry/react-native'
import { ErrorBoundary, SnackbarHost, TabBarHeightProvider } from '@shared/core/components/base'
import { CoreProvider } from '@shared/core/runtime'
import { useLoadFonts } from '@shared/core/services/fonts'
import { useOtaUpdateInit } from '@shared/core/services/otaUpdate'
import { QueryProvider } from '@shared/core/services/queries'
import { useRevenueCatInit } from '@shared/core/services/revenueCat'
import { useRTLSync } from '@shared/core/services/rtl'
import { initSentry } from '@shared/core/services/sentry'
import { useUserIdentityInit } from '@shared/core/services/userIdentity'
import { useOnboardingState } from '@shared/core/stores/features/onboarding'
import Constants from 'expo-constants'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { I18nProvider } from '@/i18n'
import { useAdsInit } from '@/services/ads'
import { CaptureProvider } from '@/services/camera/CaptureProvider'
import { setAnalyticsUserProperties, useScreenTracker } from '@/services/firebase/analytics'
import { useTheme } from '@/theme'

import { coreRuntime } from '../bootstrap'

initSentry(coreRuntime.config)
setAnalyticsUserProperties({ app_version: Constants.expoConfig?.version ?? 'unknown' })
void SplashScreen.preventAutoHideAsync()
SplashScreen.setOptions({ fade: true, duration: 250 })

function RootLayoutContent() {
  const { hasCompletedOnboarding } = useOnboardingState()
  const { appearance, colors, typography } = useTheme()
  const pathname = usePathname()
  const captureActive = pathname === '/'
  const captureRetained = captureActive || pathname === '/settings'
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

  const stack = (
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
        headerBackTitleStyle: {
          fontFamily: typography.fontFamily.regular,
        },
        contentStyle: {
          backgroundColor: colors.background.base,
        },
      }}>
      <Stack.Protected guard={hasCompletedOnboarding}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="projects/[mediaId]" options={{ presentation: 'card' }} />
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
  )

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={appearance === 'light' ? 'dark' : 'light'} />
      {hasCompletedOnboarding ? (
        <CaptureProvider active={captureActive} retained={captureRetained}>
          {stack}
        </CaptureProvider>
      ) : (
        stack
      )}
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

  // setup:ads selects a no-native implementation for this shared hook when ads are disabled.
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

const AppRoot = () => (
  <CoreProvider runtime={coreRuntime}>
    <RootLayout />
  </CoreProvider>
)
export default Sentry.wrap(AppRoot)
