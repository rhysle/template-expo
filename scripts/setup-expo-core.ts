export type JsonObject = Record<string, unknown>

export type AppIdentity = {
  displayName: string
  slug: string
  iosBundleIdentifier: string
  androidPackage: string
  scheme: string
}

const PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const IOS_BUNDLE_IDENTIFIER_PATTERN = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/
const ANDROID_PACKAGE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/
const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*$/

const assertValid = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message)
}

export const getExpoConfig = (appJson: JsonObject): JsonObject => {
  const expo = appJson.expo
  if (!expo || typeof expo !== 'object' || Array.isArray(expo)) {
    throw new Error('app.json must contain an "expo" object.')
  }

  return expo as JsonObject
}

export const deriveSlug = (displayName: string): string =>
  displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const parseEasUsername = (output: string): string => {
  const username = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!username) throw new Error('EAS CLI did not return a username.')
  return username
}

export const validateDisplayName = (displayName: string): void => {
  assertValid(displayName.trim().length > 0, 'Display name cannot be empty.')
}

export const validateSlug = (slug: string): void => {
  assertValid(
    SLUG_PATTERN.test(slug),
    'Use a lowercase URL-friendly slug, such as "habit-tracker".'
  )
}

export const validateIosBundleIdentifier = (bundleIdentifier: string): void => {
  assertValid(
    IOS_BUNDLE_IDENTIFIER_PATTERN.test(bundleIdentifier),
    'Use a reverse-DNS iOS bundle identifier, such as "com.example.habittracker".'
  )
}

export const validateAndroidPackage = (packageName: string): void => {
  assertValid(
    ANDROID_PACKAGE_PATTERN.test(packageName),
    'Use a lowercase reverse-DNS Android package, such as "com.example.habittracker".'
  )
}

export const validateScheme = (scheme: string): void => {
  assertValid(
    SCHEME_PATTERN.test(scheme),
    'The URL scheme must start with a letter and contain only letters, digits, "+", "-", or ".".'
  )
}

export const validateProjectId = (projectId: string): void => {
  assertValid(PROJECT_ID_PATTERN.test(projectId), 'Expo project ID must be a valid UUID.')
}

export const applyAppIdentity = (
  packageJson: JsonObject,
  packageLock: JsonObject,
  appJson: JsonObject,
  identity: AppIdentity
): void => {
  validateDisplayName(identity.displayName)
  validateSlug(identity.slug)
  validateIosBundleIdentifier(identity.iosBundleIdentifier)
  validateAndroidPackage(identity.androidPackage)
  validateScheme(identity.scheme)

  packageJson.name = identity.slug
  packageLock.name = identity.slug

  const packages = packageLock.packages
  if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
    throw new Error('package-lock.json must contain a "packages" object.')
  }

  const rootPackageMetadata = (packages as JsonObject)['']
  if (
    !rootPackageMetadata ||
    typeof rootPackageMetadata !== 'object' ||
    Array.isArray(rootPackageMetadata)
  ) {
    throw new Error('package-lock.json must contain root package metadata.')
  }
  ;(rootPackageMetadata as JsonObject).name = identity.slug

  const expo = getExpoConfig(appJson)
  expo.name = identity.displayName
  expo.slug = identity.slug
  expo.scheme = identity.scheme

  const ios = expo.ios
  if (!ios || typeof ios !== 'object' || Array.isArray(ios)) {
    throw new Error('app.json "expo.ios" must be an object.')
  }
  ;(ios as JsonObject).bundleIdentifier = identity.iosBundleIdentifier

  const android = expo.android
  if (!android || typeof android !== 'object' || Array.isArray(android)) {
    throw new Error('app.json "expo.android" must be an object.')
  }
  ;(android as JsonObject).package = identity.androidPackage

  removeExistingEasProjectLink(expo)
}

export const removeExistingEasProjectLink = (expo: JsonObject): void => {
  const extra = expo.extra
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    const eas = (extra as JsonObject).eas
    if (eas && typeof eas === 'object' && !Array.isArray(eas)) {
      delete (eas as JsonObject).projectId
      if (Object.keys(eas).length === 0) delete (extra as JsonObject).eas
    }
  }

  const updates = expo.updates
  if (updates && typeof updates === 'object' && !Array.isArray(updates)) {
    delete (updates as JsonObject).url
    if (Object.keys(updates).length === 0) delete expo.updates
  }

  delete expo.owner
}

export const setProjectId = (appJson: JsonObject, projectId: string): void => {
  validateProjectId(projectId)

  const expo = getExpoConfig(appJson)
  const extra = (expo.extra ??= {})
  if (typeof extra !== 'object' || Array.isArray(extra)) {
    throw new Error('app.json "expo.extra" must be an object.')
  }

  const eas = ((extra as JsonObject).eas ??= {})
  if (typeof eas !== 'object' || Array.isArray(eas)) {
    throw new Error('app.json "expo.extra.eas" must be an object.')
  }

  ;(eas as JsonObject).projectId = projectId
  expo.updates = { ...(expo.updates as JsonObject), url: `https://u.expo.dev/${projectId}` }
}

export const getProjectId = (appJson: JsonObject): string | undefined => {
  const expo = getExpoConfig(appJson)
  const extra = expo.extra
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return undefined

  const eas = (extra as JsonObject).eas
  if (!eas || typeof eas !== 'object' || Array.isArray(eas)) return undefined

  const projectId = (eas as JsonObject).projectId
  return typeof projectId === 'string' ? projectId : undefined
}
