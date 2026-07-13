import { Platform } from 'react-native'
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
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
