import type { Command } from './types'

export const requireCommandConfirmation = (command: Command, args: readonly string[]): void => {
  if (command === 'activate' && !args.includes('--confirm')) {
    throw new Error(
      'Activation changes live Apple trials and makes Google Play products purchasable. Re-run with:\n' +
        'npm run monetization:activate -- --confirm'
    )
  }
  if (command === 'prices-apply' && !args.includes('--confirm')) {
    throw new Error(
      'Regional price changes affect live store products. Re-run with:\n' +
        'npm run monetization:prices:apply -- --confirm'
    )
  }
}
