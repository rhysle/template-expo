#!/usr/bin/env npx tsx

import { AppleStoreClient } from './apple'
import { config } from './config'
import { readStoreEnvironment } from './env'
import { GooglePlayClient } from './google'
import { Reporter } from './reporter'
import { RevenueCatClient } from './revenuecat'
import type { Command } from './types'

const COMMANDS: Command[] = ['plan', 'apply', 'verify', 'activate']

const usage = (): string =>
  `
Usage:
  npm run monetization:plan
  npm run monetization:apply
  npm run monetization:verify
  npm run monetization:activate -- --confirm

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
  if (command === 'activate' && !process.argv.includes('--confirm')) {
    throw new Error(
      'Activation makes Google Play products purchasable. Re-run with:\n' +
        'npm run monetization:activate -- --confirm'
    )
  }

  const environment = readStoreEnvironment(config)
  const reporter = new Reporter(command)
  console.log(`\nMonetization ${command}`)
  console.log(`App: ${environment.appName}`)
  console.log(`Products: ${config.enabledProducts.join(', ')}`)

  if (command === 'activate') {
    if (!config.stores.google || !environment.google) {
      reporter.info('Google Play is disabled; nothing to activate')
    } else {
      await new GooglePlayClient(config, environment.google, reporter).activate()
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
