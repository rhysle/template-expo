#!/usr/bin/env npx tsx

import { AppleStoreClient } from './apple'
import { config } from './config'
import { requireCommandConfirmation } from './confirmation'
import { readStoreEnvironment } from './env'
import { GooglePlayClient } from './google'
import { Reporter } from './reporter'
import { RevenueCatClient } from './revenuecat'
import type { Command } from './types'

const COMMANDS: Command[] = [
  'plan',
  'apply',
  'verify',
  'activate',
  'prices-plan',
  'prices-apply',
  'prices-verify',
]

const usage = (): string =>
  `
Usage:
  npm run monetization:plan
  npm run monetization:apply
  npm run monetization:verify
  npm run monetization:activate -- --confirm
  npm run monetization:prices:plan
  npm run monetization:prices:apply -- --confirm
  npm run monetization:prices:verify

Edit src/configs/monetization.ts to select weekly, monthly, yearly, and/or lifetime products.
App identifiers are read from app.json; remote credentials are loaded from .env.fastlane.local.
`.trim()

const parseCommand = (): Command => {
  const value = process.argv[2]
  if (!COMMANDS.includes(value as Command)) {
    throw new Error(value ? `Unknown command: ${value}\n\n${usage()}` : usage())
  }
  return value as Command
}

const main = async (): Promise<void> => {
  const command = parseCommand()
  requireCommandConfirmation(command, process.argv)

  const priceCommand = command.startsWith('prices-')
  const environment = readStoreEnvironment(config, { revenueCat: !priceCommand })
  const reporter = new Reporter(command)
  console.log(`\nMonetization ${command}`)
  console.log(`App: ${environment.appName}`)
  console.log(`Products: ${config.enabledProducts.join(', ')}`)

  if (command === 'activate') {
    if (config.stores.apple && environment.apple) {
      await new AppleStoreClient(config, environment.apple, reporter).activate()
    }
    if (config.stores.google && environment.google) {
      await new GooglePlayClient(config, environment.google, reporter).activate()
    }
    if (!config.stores.apple && !config.stores.google) {
      reporter.info('Apple and Google stores are disabled; nothing to activate')
    }
    reporter.finish()
    return
  }

  if (priceCommand) {
    if (config.stores.apple && environment.apple) {
      await new AppleStoreClient(config, environment.apple, reporter).syncPrices()
    }
    if (config.stores.google && environment.google) {
      await new GooglePlayClient(config, environment.google, reporter).syncPrices()
    }
    if (!config.stores.apple && !config.stores.google) {
      reporter.info('Apple and Google stores are disabled; nothing to price')
    }
    reporter.finish()
    return
  }

  if (config.stores.apple && environment.apple) {
    await new AppleStoreClient(config, environment.apple, reporter).sync()
  }
  if (config.stores.google && environment.google) {
    await new GooglePlayClient(config, environment.google, reporter).sync()
  }
  if (config.stores.revenueCat && environment.revenueCat) {
    await new RevenueCatClient(config, environment.revenueCat, reporter).sync()
  }

  reporter.finish()
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\nMonetization command failed: ${message}`)
  if (process.env.DEBUG_MONETIZATION === '1' && error instanceof Error) {
    console.error(error.stack)
  }
  process.exitCode = 1
})
