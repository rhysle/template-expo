import type { FreeTrialDuration } from './types'

export const FREE_TRIAL_DURATIONS = [
  '3-days',
  '7-days',
  '14-days',
  '1-month',
  '2-months',
  '3-months',
  '6-months',
  '1-year',
] as const satisfies readonly FreeTrialDuration[]

export const APPLE_FREE_TRIAL_DURATION: Record<FreeTrialDuration, string> = {
  '3-days': 'THREE_DAYS',
  '7-days': 'ONE_WEEK',
  '14-days': 'TWO_WEEKS',
  '1-month': 'ONE_MONTH',
  '2-months': 'TWO_MONTHS',
  '3-months': 'THREE_MONTHS',
  '6-months': 'SIX_MONTHS',
  '1-year': 'ONE_YEAR',
}

export const GOOGLE_FREE_TRIAL_DURATION: Record<FreeTrialDuration, string> = {
  '3-days': 'P3D',
  '7-days': 'P7D',
  '14-days': 'P14D',
  '1-month': 'P1M',
  '2-months': 'P2M',
  '3-months': 'P3M',
  '6-months': 'P6M',
  '1-year': 'P1Y',
}
