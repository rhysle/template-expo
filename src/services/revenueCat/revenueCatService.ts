import { Platform } from 'react-native'
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from 'react-native-purchases'

import { AppConfig } from '@/configs'

const resolveRevenueCatApiKey = (): string => {
  if (__DEV__) {
    const testStoreApiKey = AppConfig.revenueCat.testStoreApiKey.trim()
    if (!testStoreApiKey) {
      throw new Error('AppConfig.revenueCat.testStoreApiKey is required for development builds.')
    }
    if (!testStoreApiKey.startsWith('test_')) {
      throw new Error('Development builds must use a RevenueCat Test Store API key.')
    }
    return testStoreApiKey
  }

  const isIos = Platform.OS === 'ios'
  const apiKey = isIos
    ? AppConfig.revenueCat.iosApiKey.trim()
    : AppConfig.revenueCat.androidApiKey.trim()
  const expectedPrefix = isIos ? 'appl_' : 'goog_'

  if (!apiKey.startsWith(expectedPrefix)) {
    throw new Error(
      `Production ${Platform.OS} builds must use a RevenueCat ${expectedPrefix} API key.`
    )
  }
  return apiKey
}

export const initRevenueCat = (appUserID?: string): void => {
  if (__DEV__) {
    void Purchases.setLogLevel(LOG_LEVEL.DEBUG)
  }

  Purchases.configure({ apiKey: resolveRevenueCatApiKey(), appUserID })
}

export const fetchOfferings = async () => {
  const offerings = await Purchases.getOfferings()
  return offerings.current?.availablePackages ?? []
}

const getPurchasesErrorProperty = (error: unknown, property: string): unknown => {
  if (error === null || typeof error !== 'object') return undefined
  return (error as Record<string, unknown>)[property]
}

export const isRevenueCatConnectivityError = (error: unknown): boolean => {
  const code = getPurchasesErrorProperty(error, 'code')
  return (
    code === PURCHASES_ERROR_CODE.NETWORK_ERROR ||
    code === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR
  )
}

export const getRevenueCatErrorDetails = (
  error: unknown
): Record<string, string | boolean> | undefined => {
  const details: Record<string, string | boolean> = {}

  for (const property of ['code', 'readableErrorCode', 'underlyingErrorMessage'] as const) {
    const value = getPurchasesErrorProperty(error, property)
    if (typeof value === 'string') details[property] = value
  }

  const userInfo = getPurchasesErrorProperty(error, 'userInfo')
  if (userInfo !== null && typeof userInfo === 'object') {
    const readableErrorCode = (userInfo as Record<string, unknown>).readableErrorCode
    if (typeof readableErrorCode === 'string') details.readableErrorCode = readableErrorCode
  }

  const userCancelled = getPurchasesErrorProperty(error, 'userCancelled')
  if (typeof userCancelled === 'boolean') details.userCancelled = userCancelled

  return Object.keys(details).length > 0 ? details : undefined
}

export const isBillingUnavailableError = (error: unknown): boolean => {
  if (error === null || typeof error !== 'object') return false

  const { message, underlyingErrorMessage } = error as {
    message?: unknown
    underlyingErrorMessage?: unknown
  }

  return [message, underlyingErrorMessage].some(
    (value) => typeof value === 'string' && /\bBILLING_UNAVAILABLE\b/i.test(value)
  )
}

type PurchasePackageResult =
  | { outcome: 'success'; customerInfo: CustomerInfo }
  | { outcome: 'cancelled'; customerInfo: null }
  | { outcome: 'entitlement_missing'; customerInfo: CustomerInfo }

export const purchasePackage = async (pkg: PurchasesPackage): Promise<PurchasePackageResult> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg)
    return checkEntitlement(customerInfo)
      ? { outcome: 'success', customerInfo }
      : { outcome: 'entitlement_missing', customerInfo }
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'userCancelled' in error &&
      (error as { userCancelled: boolean }).userCancelled
    ) {
      return { outcome: 'cancelled', customerInfo: null }
    }
    throw error
  }
}

export const restorePurchases = async (): Promise<{
  success: boolean
  customerInfo: CustomerInfo
}> => {
  const customerInfo = await Purchases.restorePurchases()
  return { success: checkEntitlement(customerInfo), customerInfo }
}

export const checkEntitlement = (customerInfo: CustomerInfo): boolean => {
  return typeof customerInfo.entitlements.active[AppConfig.revenueCat.entitlementId] !== 'undefined'
}

export const getActiveEntitlementId = (customerInfo: CustomerInfo): string | null => {
  const entitlement = customerInfo.entitlements.active[AppConfig.revenueCat.entitlementId]
  return entitlement?.identifier ?? null
}

export const addCustomerInfoListener = (callback: (info: CustomerInfo) => void): (() => void) => {
  Purchases.addCustomerInfoUpdateListener(callback)
  return () => {
    Purchases.removeCustomerInfoUpdateListener(callback)
  }
}

export const getCustomerInfo = async (): Promise<CustomerInfo> => {
  return Purchases.getCustomerInfo()
}
