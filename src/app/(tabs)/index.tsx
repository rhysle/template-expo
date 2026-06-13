import { formatDistanceToNow } from 'date-fns'
import * as Network from 'expo-network'
import { useFocusEffect } from 'expo-router'
import { DotsSixVerticalIcon, TrashIcon } from 'phosphor-react-native'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, Keyboard, Platform, View } from 'react-native'
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist'
import { Gesture, GestureDetector, RefreshControl } from 'react-native-gesture-handler'
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { ConvertItem } from '@/components'
import {
  BottomSheet,
  Button,
  CollapsingHeader,
  Pressable,
  Text,
  useCollapsingHeader,
  useTabBarHeight,
} from '@/components/base'
import { NumericKeyboard } from '@/components/NumericKeyboard'
import { ScreenHeader } from '@/components/ScreenHeader'
import { type CurrencyCode } from '@/constants/currencies'
import { AppAnalyticsEvents, trackEvent } from '@/services/firebase/analytics'
import {
  RATES_OUTDATED_THRESHOLD_MS,
  useLatestRatesQuery,
  useRatesRefreshGate,
} from '@/services/queries'
import { useIsRTL } from '@/services/rtl'
import { useAppReview } from '@/services/storeReview'
import { useConverterState } from '@/stores/features/converter'
import { useSnackbarState } from '@/stores/features/snackbar'
import { createThemedStyles, iconSizes, useCommonStyles, useTheme, useThemedStyles } from '@/theme'
import {
  getConvertedRate,
  type LocalizedCurrency,
  toRateLabel,
  useCurrencyMap,
} from '@/utils/currency'
import { getDateFnsLocale } from '@/utils/dateFnsLocale'
import { haptics } from '@/utils/haptics'
import { evaluateMath } from '@/utils/math'
import { useNumberFormat } from '@/utils/numberFormat'

const isLocalizedCurrency = (
  currency: LocalizedCurrency | undefined
): currency is LocalizedCurrency => currency !== undefined

const DRAG_ACTIVATION_DISTANCE = 12
const DISABLED_DRAG_ACTIVATION_DISTANCE = 100000

const computeLastUpdated = (updatedAt: string | undefined, language: string): string | null => {
  if (!updatedAt) return null
  return formatDistanceToNow(new Date(updatedAt), {
    addSuffix: true,
    locale: getDateFnsLocale(language),
  })
}

interface CurrencyListItemProps {
  item: LocalizedCurrency
  drag: () => void
  isActive: boolean
  convertedRate: number | null
  baseCurrency: CurrencyCode
  baseAmountInput: string
  isEditing: boolean
  canRemoveMore: boolean
  onRemove: (code: CurrencyCode) => void
  onAmountPress: (code: CurrencyCode, keyboardAmount: string) => void
}

const CurrencyListItem = ({
  item: currency,
  drag,
  isActive,
  convertedRate,
  baseCurrency,
  baseAmountInput,
  isEditing,
  canRemoveMore,
  onRemove,
  onAmountPress,
}: CurrencyListItemProps) => {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const { formatAmount, locale } = useNumberFormat()

  const removeDisabled = !canRemoveMore
  const swipeEnabled = Platform.OS !== 'web' && !isEditing && !removeDisabled
  const isRTL = useIsRTL()

  const evaluatedBase = evaluateMath(baseAmountInput)
  const baseNumeric = evaluatedBase !== null ? evaluatedBase : Number(baseAmountInput) || 0

  let displayAmount: string
  let keyboardAmount: string
  if (currency.code !== baseCurrency) {
    const converted = convertedRate !== null ? baseNumeric * convertedRate : null
    keyboardAmount = converted !== null ? String(parseFloat(converted.toPrecision(10))) : '0'
    displayAmount = converted !== null ? formatAmount(converted) : '--'
  } else {
    keyboardAmount = baseAmountInput
    displayAmount = formatAmount(baseNumeric)
  }

  const dragHandle = (
    <View style={styles.dragHandle}>
      <DotsSixVerticalIcon size={iconSizes.lg} color={colors.text.muted} />
    </View>
  )

  const renderRemoveActions = (
    progress: SharedValue<number>,
    _translation: SharedValue<number>,
    swipeable: SwipeableMethods
  ) => (
    <RemoveAction
      progress={progress}
      swipeable={swipeable}
      label={t('convert.remove')}
      onPress={() => onRemove(currency.code as CurrencyCode)}
    />
  )

  return (
    <ScaleDecorator activeScale={isEditing ? 1.03 : 1}>
      <ReanimatedSwipeable
        enabled={swipeEnabled}
        friction={2}
        rightThreshold={isRTL ? undefined : 36}
        leftThreshold={isRTL ? 36 : undefined}
        overshootRight={isRTL ? undefined : false}
        overshootLeft={isRTL ? false : undefined}
        renderRightActions={isRTL ? undefined : renderRemoveActions}
        renderLeftActions={isRTL ? renderRemoveActions : undefined}>
        <ConvertItem
          code={currency.code}
          name={currency.localizedName}
          flag={currency.flag}
          baseCode={baseCurrency}
          rate={toRateLabel(convertedRate, locale)}
          amount={displayAmount}
          onAmountPress={() => onAmountPress(currency.code as CurrencyCode, keyboardAmount)}
          isEditing={isEditing}
          onRemove={() => onRemove(currency.code as CurrencyCode)}
          removeDisabled={removeDisabled}
          removeAccessibilityLabel={t('convert.remove')}
          removeDisabledAccessibilityLabel={t('convert.cannotRemoveLast')}
          dragHandle={
            <Pressable variant="ghost" onPressIn={drag} disabled={isActive || !isEditing}>
              {dragHandle}
            </Pressable>
          }
        />
      </ReanimatedSwipeable>
    </ScaleDecorator>
  )
}

interface RemoveActionProps {
  progress: SharedValue<number>
  swipeable: SwipeableMethods
  label: string
  onPress: () => void
}

const RemoveAction = ({ progress, swipeable, label, onPress }: RemoveActionProps) => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const isRTL = useIsRTL()

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.6, 1]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [isRTL ? -24 : 24, 0]) }],
  }))

  const handlePress = () => {
    swipeable.close()
    onPress()
  }

  const tap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(handlePress)
  })

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        style={[styles.swipeAction, animatedStyle]}
        accessibilityRole="button"
        accessibilityLabel={label}>
        <View style={isRTL ? styles.swipeActionCoverEnd : styles.swipeActionCoverStart} />
        <View style={styles.swipeActionButton}>
          <TrashIcon size={iconSizes.md} color={colors.text.inverse} />
          <Text variant="caption" weight="bold" style={styles.swipeActionLabel}>
            {label}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  )
}

export default function ConvertScreen() {
  const { t, i18n } = useTranslation()
  const commonStyles = useCommonStyles()
  const styles = useThemedStyles(createStyles)
  const tabBarHeight = useTabBarHeight()
  const {
    baseCurrency,
    baseAmountInput,
    selectedCurrencyCodes,
    setBaseCurrency,
    setBaseAmountInput,
    removeSelectedCurrency,
    setSelectedCurrencies,
  } = useConverterState()
  const { showSnackbar } = useSnackbarState()
  const currencyMap = useCurrencyMap()
  const { data: latestRates, isFetching, refetch } = useLatestRatesQuery()
  const { gatedRefetch } = useRatesRefreshGate(refetch, latestRates?.updatedAt)
  const { requestReview } = useAppReview()
  const { colors } = useTheme()
  const {
    scrollOffset,
    largeTitleAnimatedStyle,
    onScrollOffsetChange,
    headerHeight: collapsingHeaderHeight,
  } = useCollapsingHeader({
    headerInset: true,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [activeKeyboard, setActiveKeyboard] = useState<{
    code: CurrencyCode
    amount: string
  } | null>(null)
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(() =>
    computeLastUpdated(latestRates?.updatedAt, i18n.language)
  )

  useEffect(() => {
    setLastUpdatedTime(computeLastUpdated(latestRates?.updatedAt, i18n.language))
  }, [latestRates?.updatedAt, i18n.language])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setLastUpdatedTime(computeLastUpdated(latestRates?.updatedAt, i18n.language))
      }
    })
    return () => subscription.remove()
  }, [latestRates?.updatedAt, i18n.language])

  useFocusEffect(
    useCallback(() => {
      setLastUpdatedTime(computeLastUpdated(latestRates?.updatedAt, i18n.language))
    }, [latestRates?.updatedAt, i18n.language])
  )

  const selectedCurrencies = selectedCurrencyCodes
    .map((code) => currencyMap.get(code))
    .filter(isLocalizedCurrency)

  const canRemoveMore = selectedCurrencyCodes.length > 1

  const handleRemoveCurrency = (currencyCode: CurrencyCode) => {
    Keyboard.dismiss()

    if (!canRemoveMore) {
      showSnackbar({
        title: t('convert.cannotRemoveLast'),
        variant: 'warning',
      })
      return
    }

    void haptics.light()
    trackEvent(AppAnalyticsEvents.CURRENCY_REMOVED, { currency_code: currencyCode })
    const snapshot = [...selectedCurrencyCodes]
    removeSelectedCurrency(currencyCode)
    showSnackbar({
      title: t('convert.removed', { code: currencyCode }),
      variant: 'neutral',
      action: {
        label: t('convert.undo'),
        onPress: () => setSelectedCurrencies(snapshot),
      },
    })
  }

  const handleAmountPress = (code: CurrencyCode, keyboardAmount: string) => {
    setActiveKeyboard({ code, amount: keyboardAmount })
  }

  const renderItem = ({ item: currency, drag, isActive }: RenderItemParams<LocalizedCurrency>) => {
    const convertedRate = latestRates
      ? getConvertedRate(latestRates.data.base, latestRates.data.rates, baseCurrency, currency.code)
      : null

    return (
      <CurrencyListItem
        item={currency}
        drag={drag}
        isActive={isActive}
        convertedRate={convertedRate}
        baseCurrency={baseCurrency}
        baseAmountInput={baseAmountInput}
        isEditing={isEditing}
        canRemoveMore={canRemoveMore}
        onRemove={handleRemoveCurrency}
        onAmountPress={handleAmountPress}
      />
    )
  }

  const listHeader = (
    <Animated.View style={largeTitleAnimatedStyle}>
      <ScreenHeader
        title={t('convert.title')}
        subtitle={t('convert.subtitle')}
        right={
          <Button
            variant="ghost"
            size="sm"
            label={isEditing ? t('convert.done') : t('convert.edit')}
            onPress={() => {
              void haptics.light()
              setIsEditing((v) => !v)
            }}
          />
        }
      />
    </Animated.View>
  )

  const networkState = Network.useNetworkState()
  const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false
  const isRatesOutdated =
    !!latestRates?.updatedAt &&
    Date.now() - new Date(latestRates.updatedAt).getTime() > RATES_OUTDATED_THRESHOLD_MS

  const listFooter =
    lastUpdatedTime || isOffline ? (
      <View style={styles.lastUpdatedFooter}>
        {lastUpdatedTime && (
          <Text variant="caption" tone="muted">
            {t('convert.lastUpdated', { time: lastUpdatedTime })}
          </Text>
        )}
        {isOffline && (
          <Text variant="caption" tone="muted">
            {isRatesOutdated ? t('convert.ratesOutdated') : t('common.offline')}
          </Text>
        )}
      </View>
    ) : null

  return (
    <>
      <DraggableFlatList
        data={selectedCurrencies}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        onDragBegin={() => void haptics.light()}
        onDragEnd={({ data }) => {
          void haptics.light()
          setSelectedCurrencies(data.map((c) => c.code as CurrencyCode))
        }}
        activationDistance={
          isEditing ? DRAG_ACTIVATION_DISTANCE : DISABLED_DRAG_ACTIVATION_DISTANCE
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => void gatedRefetch()}
            tintColor={colors.primary.main}
            colors={[colors.primary.main]}
            progressBackgroundColor={colors.background.surface}
            enabled={!isEditing}
          />
        }
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        containerStyle={styles.container}
        style={commonStyles.container}
        contentContainerStyle={[
          styles.listContent,
          Platform.OS !== 'ios' && { paddingTop: collapsingHeaderHeight },
          { paddingBottom: tabBarHeight },
        ]}
        contentInset={Platform.OS === 'ios' ? { top: collapsingHeaderHeight } : undefined}
        automaticallyAdjustContentInsets={false}
        onScrollOffsetChange={onScrollOffsetChange}
        showsVerticalScrollIndicator={false}
      />

      <CollapsingHeader
        title={t('convert.title')}
        scrollOffset={scrollOffset}
        right={
          <Button
            variant="ghost"
            size="sm"
            label={isEditing ? t('convert.done') : t('convert.edit')}
            onPress={() => {
              void haptics.light()
              setIsEditing((v) => !v)
            }}
          />
        }
      />

      <BottomSheet visible={activeKeyboard !== null} onClose={() => setActiveKeyboard(null)}>
        {activeKeyboard && (
          <NumericKeyboard
            initialAmount={activeKeyboard.amount}
            onChangeAmount={(newAmount) => {
              if (baseCurrency !== activeKeyboard.code) {
                setBaseCurrency(activeKeyboard.code)
              }
              setBaseAmountInput(newAmount)
            }}
            onDone={(finalAmount) => {
              if (baseCurrency !== activeKeyboard.code) {
                trackEvent(AppAnalyticsEvents.SETTINGS_DEFAULT_CURRENCY_CHANGED, {
                  from_currency: baseCurrency,
                  to_currency: activeKeyboard.code,
                })
                setBaseCurrency(activeKeyboard.code)
              }
              setBaseAmountInput(finalAmount)
              setActiveKeyboard(null)
              void requestReview()
            }}
          />
        )}
      </BottomSheet>
    </>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: t.spacing.lg,
  },
  lastUpdatedFooter: {
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    marginBottom: t.spacing.xl,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingEnd: t.spacing.lg,
    backgroundColor: t.colors.status.error,
    borderTopEndRadius: t.borderRadius.lg,
    borderBottomEndRadius: t.borderRadius.lg,
    marginBottom: t.spacing.sm,
  },
  swipeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.md,
  },
  swipeActionLabel: {
    color: t.colors.text.inverse,
  },
  swipeActionCoverStart: {
    position: 'absolute',
    left: -20,
    top: 0,
    bottom: 0,
    width: 20,
    backgroundColor: t.colors.status.error,
  },
  swipeActionCoverEnd: {
    position: 'absolute',
    right: -20,
    top: 0,
    bottom: 0,
    width: 20,
    backgroundColor: t.colors.status.error,
  },
  dragHandle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
}))
