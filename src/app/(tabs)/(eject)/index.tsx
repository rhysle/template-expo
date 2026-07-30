import { useIsFocused } from 'expo-router'
import { LightningIcon, LockKeyIcon, SpeakerSlashIcon } from 'phosphor-react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type LayoutChangeEvent, useWindowDimensions, View } from 'react-native'

import {
  AudioToolScreen,
  CircularAudioButton,
  EJECT_OCEAN_SURFACE_OFFSET,
  EjectDurationPill,
  EjectOcean,
  MascotHero,
  useEjectTilt,
} from '@/components/audio'
import { EjectTurboGuideSheet } from '@/components/audio/EjectTurboGuideSheet'
import { InlineNotice, NativeToggle, Text } from '@/components/base'
import { usePreventInterstitialAd, useRequestInterstitialAd } from '@/services/ads'
import {
  audioController,
  getAudioResultState,
  useAudioController,
  useAudioToolLifecycle,
} from '@/services/audio'
import { AnalyticsAppEvents, trackEvent } from '@/services/firebase/analytics'
import { type PaywallSource, usePremiumGate } from '@/services/revenueCat'
import { useIsRTL } from '@/services/rtl'
import { useAppReview } from '@/services/storeReview'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'
import { haptics } from '@/utils/haptics'

const EJECT_TURBO_PAYWALL_SOURCE = 'eject_turbo' satisfies PaywallSource
const EJECT_IDLE_MASCOT = require('@/assets/images/mascot/eject-idle.png')
const EJECT_ACTIVE_MASCOT = require('@/assets/images/mascot/eject-active.png')
const MASCOT_WATERLINE_RATIO = 0.64

interface HeroLayout {
  height: number
  y: number
}

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(Math.ceil(seconds), 0)
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(
    safeSeconds % 60
  ).padStart(2, '0')}`
}

export default function EjectScreen() {
  const { t } = useTranslation()
  const isFocused = useIsFocused()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const isRTL = useIsRTL()
  const { height, width } = useWindowDimensions()
  const snapshot = useAudioController()
  const { premiumState, requirePremium } = usePremiumGate()
  const { requestReview } = useAppReview()
  const requestInterstitialAd = useRequestInterstitialAd()
  const { ejectDurationSeconds, ejectRoutineId, hapticsEnabled, setEjectRoutineId } =
    useAudioPreferencesState()
  const wasRunningRef = useRef(false)
  const enableTurboAfterDismissRef = useRef(false)
  const [heroLayout, setHeroLayout] = useState<HeroLayout | null>(null)
  const [turboGuideVisible, setTurboGuideVisible] = useState(false)
  const [turboToggleRequested, setTurboToggleRequested] = useState(false)
  const tiltDegrees = useEjectTilt()
  useAudioToolLifecycle()
  usePreventInterstitialAd('eject_turbo_guide', turboGuideVisible)

  const isRunning = snapshot.activeTool === 'eject' && snapshot.status === 'running'
  const isStarting = snapshot.activeTool === 'eject' && snapshot.status === 'starting'
  const isActive = isRunning || isStarting
  const isLastEjectSession = snapshot.lastTool === 'eject'
  const resultState = getAudioResultState(isLastEjectSession ? snapshot.stopReason : null)
  const durationSeconds = snapshot.durationSeconds ?? ejectDurationSeconds
  const remainingSeconds = Math.max(durationSeconds - snapshot.elapsedSeconds, 0)
  const formattedRemaining = formatDuration(remainingSeconds)
  const turboEnabled = premiumState === 'premium' && ejectRoutineId === 'turbo'
  const turboToggleValue = turboEnabled || turboToggleRequested
  const selectedRoutineId = turboEnabled ? 'turbo' : 'balanced'
  const isCompactLayout = height < 900
  const oceanTop = heroLayout
    ? Math.max(
        heroLayout.y + heroLayout.height * MASCOT_WATERLINE_RATIO - EJECT_OCEAN_SURFACE_OFFSET,
        0
      )
    : null

  useEffect(() => {
    void audioController.refreshOutputRoute()
  }, [])

  useEffect(() => {
    if (premiumState === 'free' && ejectRoutineId === 'turbo') {
      setEjectRoutineId('balanced')
    }
  }, [premiumState, ejectRoutineId, setEjectRoutineId])

  useEffect(() => {
    if (isRunning) {
      wasRunningRef.current = true
      return
    }

    if (resultState === 'completed' && wasRunningRef.current) {
      wasRunningRef.current = false
      if (hapticsEnabled) void haptics.medium()
      void (async () => {
        const reviewRequested = await requestReview()
        if (!reviewRequested) await requestInterstitialAd()
      })()
    } else if (!isActive) {
      wasRunningRef.current = false
    }
  }, [hapticsEnabled, isActive, isRunning, requestInterstitialAd, requestReview, resultState])

  const handleMainPress = async () => {
    if (isActive) {
      const wasRunning = isRunning
      await audioController.stop('manual')
      if (wasRunning) await requestInterstitialAd()
      return
    }

    const isPremium = premiumState === 'premium'
    const durationSeconds = isPremium ? ejectDurationSeconds : 30
    const routineId = isPremium ? selectedRoutineId : 'balanced'
    await audioController.startEject({
      durationSeconds,
      routineId,
    })
  }

  const applyTurboChange = (enabled: boolean) => {
    setEjectRoutineId(enabled ? 'turbo' : 'balanced')
    trackEvent(AnalyticsAppEvents.TURBO_MODE_CHANGED, {
      state: enabled ? 'enabled' : 'disabled',
    })
  }

  const handleTurboChange = (enabled: boolean) => {
    if (enabled) {
      enableTurboAfterDismissRef.current = false
      setTurboToggleRequested(true)
      setTurboGuideVisible(true)
      return
    }

    setTurboToggleRequested(false)
    applyTurboChange(false)
  }

  const handleTurboGuideConfirm = () => {
    enableTurboAfterDismissRef.current = true
    setTurboGuideVisible(false)
  }

  const handleTurboGuideDismiss = () => {
    const shouldEnableTurbo = enableTurboAfterDismissRef.current
    enableTurboAfterDismissRef.current = false
    setTurboToggleRequested(false)
    setTurboGuideVisible(false)

    if (!shouldEnableTurbo) return

    requirePremium(EJECT_TURBO_PAYWALL_SOURCE, () => applyTurboChange(true))
  }

  const handleHeroLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { height: nextHeight, y: nextY } = nativeEvent.layout
    setHeroLayout((current) => {
      if (current?.height === nextHeight && current.y === nextY) return current
      return { height: nextHeight, y: nextY }
    })
  }

  return (
    <>
      <AudioToolScreen variant="focused">
        <View style={[styles.turboMode, isActive && styles.turboModeDisabled]}>
          <View style={styles.turboTitleRow}>
            <LightningIcon
              size={iconSizes.sm}
              color={turboEnabled ? theme.colors.primary.main : theme.colors.text.secondary}
              weight={turboEnabled ? 'fill' : 'bold'}
            />
            <Text variant="body" weight="semibold">
              {t('audioTools.eject.turbo.title')}
            </Text>
            {premiumState !== 'premium' ? (
              <LockKeyIcon size={iconSizes.xs} color={theme.colors.text.muted} weight="fill" />
            ) : null}
          </View>
          <NativeToggle
            value={turboToggleValue}
            onValueChange={handleTurboChange}
            disabled={isActive}
            style={styles.turboToggle}
            testID="eject-turbo-toggle"
          />
        </View>

        <View style={styles.primaryInteraction}>
          <View onLayout={handleHeroLayout} style={styles.heroSlot}>
            <MascotHero
              active={isActive}
              adrift
              compact={isCompactLayout}
              fillAvailableSpace
              source={isActive ? EJECT_ACTIVE_MASCOT : EJECT_IDLE_MASCOT}
              style={styles.mascot}
              tiltDegrees={tiltDegrees}
            />
          </View>

          {oceanTop !== null ? (
            <EjectOcean
              active={isActive}
              turbo={isActive && selectedRoutineId === 'turbo'}
              style={[
                styles.ocean,
                {
                  top: oceanTop,
                  width,
                  transform: [{ translateX: (isRTL ? 1 : -1) * (width / 2) }],
                },
              ]}
              tiltDegrees={tiltDegrees}
            />
          ) : null}

          <View style={styles.controlSection}>
            <View style={styles.controlCluster}>
              <View style={styles.mainControlSlot}>
                <View
                  accessibilityElementsHidden={!isActive}
                  accessibilityLabel={isActive ? formattedRemaining : undefined}
                  accessibilityRole={isActive ? 'timer' : undefined}
                  importantForAccessibility={isActive ? 'auto' : 'no-hide-descendants'}
                  pointerEvents="none"
                  style={[styles.remainingTime, !isActive && styles.remainingTimeHidden]}>
                  <Text variant="title" weight="bold" tone="accent" style={styles.timer}>
                    {formattedRemaining}
                  </Text>
                </View>

                <View style={styles.mainControl}>
                  <CircularAudioButton
                    active={isActive}
                    haptic={hapticsEnabled}
                    pulsing={isFocused && !isActive}
                    accessibilityLabel={
                      isActive ? t('audioTools.eject.stop') : t('audioTools.eject.start')
                    }
                    onPress={handleMainPress}
                  />
                  <Text
                    variant="subtitle"
                    weight="semibold"
                    align="center"
                    style={{
                      color: isActive ? theme.colors.status.error : theme.colors.primary.main,
                    }}>
                    {isActive ? t('audioTools.eject.stop') : t('audioTools.eject.start')}
                  </Text>
                </View>
              </View>

              <EjectDurationPill disabled={isActive} style={styles.durationPill} />
            </View>
          </View>
        </View>

        {snapshot.outputRouteKind === 'external' ? (
          <InlineNotice
            title={t('audioTools.eject.externalTitle')}
            tone="warning"
            icon={SpeakerSlashIcon}>
            {t('audioTools.eject.externalBody')}
          </InlineNotice>
        ) : null}

        {snapshot.status === 'error' && isLastEjectSession ? (
          <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
        ) : null}
      </AudioToolScreen>

      <EjectTurboGuideSheet
        visible={turboGuideVisible}
        onConfirm={handleTurboGuideConfirm}
        onDismiss={handleTurboGuideDismiss}
      />
    </>
  )
}

const createStyles = createThemedStyles((t) => ({
  turboMode: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.xl,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    backgroundColor: t.colors.background.subtle,
    borderCurve: 'continuous',
    borderRadius: t.borderRadius.xl,
  },
  turboModeDisabled: {
    opacity: 0.5,
  },
  turboTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  turboToggle: {
    width: 56,
    height: 36,
  },
  primaryInteraction: {
    position: 'relative',
    minHeight: 0,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
  },
  heroSlot: {
    position: 'relative',
    zIndex: 1,
    minHeight: 0,
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocean: {
    bottom: -t.spacing.lg,
    left: '50%',
    zIndex: 2,
  },
  mascot: {
    flex: 0,
    width: '82%',
    height: '82%',
  },
  controlSection: {
    zIndex: 3,
    width: '100%',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  remainingTime: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: t.spacing.md,
    alignSelf: 'center',
    alignItems: 'center',
  },
  remainingTimeHidden: {
    opacity: 0,
  },
  timer: {
    fontSize: t.typography.sizes['6xl'],
    fontVariant: ['tabular-nums'],
  },
  controlCluster: {
    position: 'relative',
    width: '100%',
    minHeight: 152,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainControl: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  mainControlSlot: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  durationPill: {
    position: 'absolute',
    top: t.spacing.xs,
    right: 0,
  },
}))
