import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

export interface AppContext {
  appRoot: string
  repoRoot: string
}
export const getAppContext = (
  directory = process.env.RHYSLE_APP_ROOT ?? process.cwd()
): AppContext => {
  const appRoot = fs.realpathSync(directory)
  const repoRoot = path.resolve(appRoot, '../..')
  if (
    path.basename(path.dirname(appRoot)) !== 'apps' ||
    !fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml')) ||
    !fs.existsSync(path.join(appRoot, 'app.json'))
  ) {
    throw new Error(
      'Select an app: pnpm --filter @apps/<app> <command>, or set RHYSLE_APP_ROOT to its directory'
    )
  }
  return { appRoot, repoRoot }
}
export const loadAppModule = <T>(relativePath: string): T => {
  const { appRoot } = getAppContext()
  return createRequire(path.join(appRoot, 'package.json'))(path.join(appRoot, relativePath)) as T
}
export const resolveAppPackage = (name: string): string => {
  const { appRoot } = getAppContext()
  return createRequire(path.join(appRoot, 'package.json')).resolve(name)
}
