import { Platform } from 'react-native'
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from 'react-native-purchases'

import { AppConfig } from '@/configs'

export const initRevenueCat = (appUserID?: string): void => {
  if (__DEV__) {
    void Purchases.setLogLevel(LOG_LEVEL.DEBUG)
  }

  const apiKey =
    Platform.OS === 'ios' ? AppConfig.revenueCat.iosApiKey : AppConfig.revenueCat.androidApiKey

  Purchases.configure({ apiKey, appUserID })
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

export const purchasePackage = async (
  pkg: PurchasesPackage
): Promise<{ success: boolean; customerInfo: CustomerInfo | null }> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg)
    return { success: checkEntitlement(customerInfo), customerInfo }
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'userCancelled' in error &&
      (error as { userCancelled: boolean }).userCancelled
    ) {
      return { success: false, customerInfo: null }
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
