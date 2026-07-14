# Expo App Template

A production-minded Expo starter for building a new React Native app. It includes a routed app shell, design system, localization, persisted client and server state, onboarding, subscriptions, ads, analytics, error reporting, OTA updates, and store-listing automation.

This repository intentionally contains sample screens and app-specific placeholders. Treat them as starting points, not product requirements.

## Stack

- Expo SDK 57, React Native 0.86, React 19, and Expo Router
- TypeScript with strict checking and React Compiler
- Zustand + Immer with MMKV persistence
- TanStack Query with persisted query cache
- i18next / react-i18next for localization
- Reanimated, Gesture Handler, and Skia for interaction and motion
- RevenueCat, AdMob, Firebase Analytics, Sentry, and EAS integrations

## New Project Setup

Use this ordered process when turning the template into a new app. The template contains sample credentials and product content, so do not ship until every applicable section has been completed.

### 1. Configure Expo

1. Fork or copy this repository and run `npm install`.
2. Sign in to the intended Expo account, then run:

   ```bash
   npm run setup:expo
   ```

   The script prompts for an npm-style app name, updates the package and Expo app names, creates or links an EAS project, and writes the new EAS project ID and update URL to `app.json`. Do not reuse the template's EAS project ID or update URL.

3. Choose final, globally unique iOS and Android identifiers. Update `expo.scheme`, `expo.ios.bundleIdentifier`, and `expo.android.package` in `app.json`.
4. Replace icons, adaptive-icon layers, splash art, and favicon under `assets/images/`, then update their references and colors in `app.json`.

### 2. Configure Firebase Analytics

1. Create a Firebase project and register both an iOS app and an Android app using the exact bundle ID/package name from `app.json`.
2. Download `GoogleService-Info.plist` for iOS and `google-services.json` for Android. Place them at the repository root using exactly those names; `app.json` already references them.
3. The files are intentionally Git-ignored. Provide them securely to local developers and your build environment rather than committing them.
4. Replace the sample events in `src/services/firebase/analytics/analyticsAppEvents.ts`. Keep generic lifecycle events in `analyticsGeneralEvents.ts`.

### 3. Configure RevenueCat

1. Create the app in RevenueCat and connect its App Store Connect and/or Google Play products.
2. Create the entitlement that the app will use for premium access.
3. For development and testing, you can use RevenueCat's Test Store API key in `AppConfig.revenueCat.iosApiKey` and `androidApiKey` in `src/configs/AppConfig.ts`.
4. Before submitting a release to the App Store or Google Play, replace the Test Store key with the correct platform-specific production API key for each field. Never submit an app configured with a Test Store key.
5. Set `AppConfig.revenueCat.entitlementId` to the entitlement created in step 2, then replace `src/components/paywall/usePaywallFeatures.ts` and confirm the paywall and automatic-presentation behavior fit the product.

### 4. Configure Sentry

1. Create a Sentry project for the app.
2. Set `AppConfig.sentry.dsn` in `src/configs/AppConfig.ts`.
3. Update the Sentry Expo plugin's `organization` and `project` values in `app.json`.
4. Store the Sentry authentication token for EAS source-map uploads as an EAS secret; never commit it.

### 5. Configure AdMob (if the app shows ads)

1. In AdMob, create an app record for each platform and copy its app ID. Add them to `AppConfig.ads.ios.appId` and `AppConfig.ads.android.appId` in `src/configs/AppConfig.ts`.
2. For each AdMob app, open **Ad units**, choose **Add ad unit**, and create the formats used by this template: one **Banner** unit and one **Interstitial** unit.
3. Copy each platform's Banner and Interstitial ad-unit IDs into the matching `bannerAdUnitId` and `interstitialAdUnitId` fields in `AppConfig.ads`.
4. Set `AppConfig.ads.enabled` to `true`, then run `npm run setup:ads` to synchronize the native configuration. Keep the ads initialization hooks in the root and tabs layouts when ads are enabled; remove them when ads are disabled.
5. Development and preview builds automatically use Google test ad-unit IDs. The AdMob ad-unit IDs above are used by production builds.
6. Run a clean prebuild after changing the ads configuration.

### 6. Configure fonts, localization, and OTA updates

- **Fonts:** Change `FONT_NAME` in `src/configs/fonts.ts`, run `npm run setup:font`, then run a clean prebuild so the selected font is embedded in release builds.
- **Localization:** Update every locale in `src/i18n/locales/` for the product, or remove unsupported locales. Run `npm run setup:i18n` after adding or removing a locale, and `npm run check:i18n` after changing translations.
- **OTA updates:** Keep `AppConfig.otaUpdate.enabled` only when the new EAS project and update channels are ready. OTA builds and updates must share the same EAS project and runtime-version policy.

### 7. Configure app-facing settings

Replace the remaining product values in `src/configs/AppConfig.ts`:

- The iOS App Store ID once the App Store Connect record exists.
- Support email, terms-of-service URL, and privacy-policy URL.
- App-review and automatic-paywall behavior, if those template defaults do not suit the product.

### 8. Replace the template product shell

Replace the sample tabs, routes, settings preferences, onboarding pages, paywall content, analytics events, and API/query modules:

- `src/app/(tabs)/` and the tab metadata in `src/app/(tabs)/_layout.tsx`
- `src/components/onboarding/`
- `src/components/paywall/usePaywallFeatures.ts`
- `src/services/firebase/analytics/analyticsAppEvents.ts`
- Product data modules under `src/services/queries/`

### 9. Prepare store delivery

Create the App Store Connect and Google Play app records using the same identifiers as `app.json`. Then replace the template identifiers, URLs, metadata, screenshots, reviewer details, and credentials in `fastlane/` before using a `fastlane:*` command. Keep API keys, service-account JSON, signing credentials, and review credentials outside Git.

### 10. Regenerate and verify

Native configuration changes—including `app.json`, Firebase files, fonts, ads, or config plugins—require regeneration because `ios/` and `android/` are generated directories:

```bash
npm run prebuild:clean
npm run ios        # test iOS changes
npm run android    # test Android changes
npm run check
npm run check:i18n # after changing translations
npm run release:verify-config
```

Before a production build, confirm the app uses the new EAS project, Firebase configuration, Sentry project, store identifiers, support/legal URLs, and any enabled RevenueCat or AdMob credentials.

## Common Commands

```bash
npm start                 # Expo development server
npm run ios               # iOS simulator
npm run android           # Android emulator
npm run web               # Web development server

npm run lint              # ESLint
npm run check:type        # TypeScript, no emit
npm run check:i18n        # Translation key audit
npm run check             # Lint + type check
npm run format            # Format and apply safe lint fixes

npm run prebuild:clean    # Regenerate native projects from Expo config
npm run doctor            # Expo environment diagnostics
npm run align-deps        # Align installed packages with the Expo SDK

npm run setup:expo        # Rename the app and create/link its EAS project
npm run setup:ads         # Synchronize AdMob native configuration
npm run setup:font        # Synchronize the selected embedded font
npm run setup:i18n        # Synchronize supported locales in Expo config
```

## Project Layout

```text
src/
  app/             Expo Router routes and layouts
  components/      Reusable product UI and template components
  configs/         Product configuration and font selection
  i18n/            Localization setup and locale resources
  services/        External integrations and server-state infrastructure
  storage/         MMKV adapters and key namespacing
  stores/          Auto-discovered Zustand feature slices
  theme/           Design tokens, themes, and themed-style helpers
  utils/           Focused shared helpers
```

Generated `ios/` and `android/` directories must not be edited directly. Change Expo configuration or config plugins, then run a prebuild when native projects need to be regenerated.

## Product Shell

`src/app/_layout.tsx` mounts the app-wide providers and lifecycle hooks: fonts, identity, subscriptions, RTL sync, query persistence, i18n, error boundary, measured tab-bar height, analytics screen tracking, OTA update checks, and snackbar rendering.

The current routes demonstrate a common paid-app shape:

- `onboarding` is shown before the persisted onboarding gate is complete.
- `(tabs)` contains a sample Home screen and a Settings screen.
- `paywall` is a full-screen modal route available after onboarding.
- `debug` is a development-only diagnostic screen.

Replace, add, or remove routes to match the product. Keep provider initialization in the root layout unless an integration truly belongs to a narrower navigation scope.

## UI and Theme

Theme tokens live in `src/theme/`. Use `useThemedStyles(createStyles)` for themed styles and `useTheme()` for values passed to components or animation APIs. Prefer tokens for colors, spacing, typography, radius, shadows, and icon sizes.

`iconSizes` is a static token and should be imported from `@/theme`; do not supply raw icon-size literals.

Font configuration lives only in `src/configs/fonts.ts`. After changing `FONT_NAME`, run:

```bash
npm run setup:font
npm run prebuild:clean
```

The template enables RTL support through Expo configuration. `useIsRTL()` is available for visuals that cannot be mirrored automatically, such as directional canvas animations.

### Reusable Components

`src/components/base/` is the reusable layer. Notable building blocks include `Button`, `Text`, `Card`, `ListItem` variants, `Toggle`, `SegmentedControl`, `BottomSheet`, `SearchInput`, `FadeScrollView`, `Snackbar`, `CollapsingHeader`, `FloatingTabBar`, `Onboarding`, `Paywall`, and loading indicators.

Keep reusable behavior here. Put product-specific composition in `src/components/` or route files.

## State and Persistence

Zustand state is split into auto-discovered files in `src/stores/features/`. A new feature slice needs one file that declares the global `AppSlices` augmentation, exports its `sliceConfig`, and exposes a focused hook. It does not need manual registration.

```ts
import { useShallow } from 'zustand/react/shallow'
import { getUseAppStore, type ExcludeKeys, type SliceConfig } from '../slices/types'

declare global {
  interface AppSlices {
    example: ExampleSlice
  }
}

interface ExampleSlice {
  value: string
  setValue: (value: string) => void
}

export const examplePersistExcludeKeys: ExcludeKeys<ExampleSlice> = []

const createExampleSlice = (set: any): ExampleSlice => ({
  value: '',
  setValue: (value) => set((state: AppSlices) => {
    state.example.value = value
  }),
})

export const sliceConfig = {
  create: createExampleSlice,
  persistExcludeKeys: examplePersistExcludeKeys,
} satisfies SliceConfig<ExampleSlice>

export const useExampleState = () =>
  getUseAppStore()(useShallow(({ example }) => ({ value: example.value, setValue: example.setValue })))
```

Only list non-function state values in `persistExcludeKeys`; actions are excluded automatically. Add a per-slice version and migrations only after that slice has shipped persisted state.

MMKV keys use a `namespace.name` convention. Use storage helpers to create keys rather than hardcoding them.

## Data Fetching

`src/services/queries/provider/` is template infrastructure: it configures TanStack Query, network awareness, retries, persistence, and development tools. Add product API modules alongside it under `src/services/queries/`.

For a domain module, keep related code together in this order:

1. Private request function
2. Query-key export
3. Query-options export
4. Query-hook exports

Use the shared network and offline-error utilities where appropriate. Persist only successful, serializable query results.

## Localization

Locale resources live in `src/i18n/locales/`, are loaded dynamically, and are type-checked against English. User-visible product text belongs in translations, except for the development-only debug route.

```tsx
const { t } = useTranslation()
return <Text>{t('settings.title')}</Text>
```

When changing copy, update the English resource and every supported locale, then run `npm run check:i18n`. To add a locale, add its JSON resource and run `npm run setup:i18n` to synchronize `app.json`.

The i18n configuration includes `number` and `currency` formatters for products that need them, but neither is a requirement of the template.

## Build and Release

EAS profiles are defined in `eas.json`. Common production commands are `npm run eas-build`, `npm run eas-build:ios:submit`, `npm run eas-build:android:submit`, and `npm run eas-update`.

Fastlane at the repository root manages App Store Connect and Google Play listing metadata and screenshots. Update its package identifiers, shared URLs, locale folders, and credentials for each new app before running the `fastlane:*` scripts. Keep secrets and reviewer contact information out of Git.

## Verification

At a minimum, run `npm run check` after code or translation changes. For native dependency or configuration changes, also run `npm run prebuild:clean` and test the affected platform.
