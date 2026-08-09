import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyAppIdentity,
  deriveSlug,
  getProjectId,
  parseEasUsername,
  setProjectId,
  validateAndroidPackage,
  validateIosBundleIdentifier,
  validateProjectId,
  validateScheme,
  validateSlug,
} from './setup-expo-core'

const projectId = '123e4567-e89b-42d3-a456-426614174000'

void test('extracts only the username from multi-line EAS whoami output', () => {
  assert.equal(parseEasUsername('rhysle\ntuantai0625@gmail.com\n'), 'rhysle')
  assert.equal(parseEasUsername('  rhysle  \r\n'), 'rhysle')
  assert.throws(() => parseEasUsername('\n\n'), /did not return a username/)
})

void test('derives a URL-friendly slug from a display name', () => {
  assert.equal(deriveSlug('Habit Tracker'), 'habit-tracker')
  assert.equal(deriveSlug('  Café & Notes  '), 'cafe-notes')
})

void test('validates Expo and native identifiers', () => {
  assert.doesNotThrow(() => validateSlug('habit-tracker'))
  assert.doesNotThrow(() => validateIosBundleIdentifier('com.example.HabitTracker'))
  assert.doesNotThrow(() => validateAndroidPackage('com.example.habittracker'))
  assert.doesNotThrow(() => validateScheme('habit-tracker'))
  assert.doesNotThrow(() => validateProjectId(projectId))

  assert.throws(() => validateSlug('Habit Tracker'), /lowercase URL-friendly slug/)
  assert.throws(() => validateIosBundleIdentifier('habittracker'), /reverse-DNS/)
  assert.throws(() => validateAndroidPackage('com.Example.app'), /lowercase reverse-DNS/)
  assert.throws(() => validateScheme('1habit'), /must start with a letter/)
  assert.throws(() => validateProjectId('not-a-uuid'), /valid UUID/)
})

void test('applies app identity while preserving unrelated service configuration', () => {
  const packageJson = { name: 'template-expo', private: true }
  const packageLock = {
    name: 'template-expo',
    packages: { '': { name: 'template-expo', version: '1.0.0' } },
  }
  const sentryPlugin = [
    '@sentry/react-native/expo',
    { project: 'template-expo', organization: 'example' },
  ]
  const appJson = {
    expo: {
      name: 'Template Expo',
      slug: 'template-expo',
      scheme: 'com.example.template',
      owner: 'example',
      ios: { bundleIdentifier: 'com.example.template', supportsTablet: true },
      android: { package: 'com.example.template', allowBackup: false },
      plugins: [sentryPlugin],
      extra: { router: {}, eas: { projectId } },
      updates: { enabled: true, url: `https://u.expo.dev/${projectId}` },
    },
  }

  applyAppIdentity(packageJson, packageLock, appJson, {
    displayName: 'Habit Tracker',
    slug: 'habit-tracker',
    iosBundleIdentifier: 'com.acme.habittracker',
    androidPackage: 'com.acme.habittracker',
    scheme: 'habit-tracker',
  })

  assert.equal(packageJson.name, 'habit-tracker')
  assert.equal(packageLock.name, 'habit-tracker')
  assert.equal(packageLock.packages[''].name, 'habit-tracker')
  assert.equal(appJson.expo.name, 'Habit Tracker')
  assert.equal(appJson.expo.slug, 'habit-tracker')
  assert.equal(appJson.expo.scheme, 'habit-tracker')
  assert.deepEqual(appJson.expo.ios, {
    bundleIdentifier: 'com.acme.habittracker',
    supportsTablet: true,
  })
  assert.deepEqual(appJson.expo.android, {
    package: 'com.acme.habittracker',
    allowBackup: false,
  })
  assert.deepEqual(appJson.expo.plugins, [sentryPlugin])
  assert.deepEqual(appJson.expo.extra, { router: {} })
  assert.deepEqual(appJson.expo.updates, { enabled: true })
  assert.equal('owner' in appJson.expo, false)
})

void test('writes and reads the EAS project link without discarding update settings', () => {
  const appJson = {
    expo: {
      name: 'Habit Tracker',
      slug: 'habit-tracker',
      extra: { router: {} },
      updates: { enabled: true },
    },
  }

  setProjectId(appJson, projectId)

  assert.equal(getProjectId(appJson), projectId)
  assert.deepEqual(appJson.expo.extra, { router: {}, eas: { projectId } })
  assert.deepEqual(appJson.expo.updates, {
    enabled: true,
    url: `https://u.expo.dev/${projectId}`,
  })
})

void test('rejects malformed package-lock root metadata before writing files', () => {
  assert.throws(
    () =>
      applyAppIdentity(
        { name: 'template-expo' },
        { name: 'template-expo', packages: {} },
        { expo: { ios: {}, android: {} } },
        {
          displayName: 'Habit Tracker',
          slug: 'habit-tracker',
          iosBundleIdentifier: 'com.acme.habittracker',
          androidPackage: 'com.acme.habittracker',
          scheme: 'habit-tracker',
        }
      ),
    /root package metadata/
  )
})
