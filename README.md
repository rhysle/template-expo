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

Before implementing product features, fill in [`docs/PRODUCT.md`](docs/PRODUCT.md) with the app's problem, users, scope, core flows, requirements, privacy choices, monetization, analytics, and release criteria. Keep it lightweight and remove sections that do not apply.

### 1. Configure Expo

1. Fork or copy this repository and run `npm install`.
2. Sign in to the intended Expo account, then run:

   ```bash
   npm run setup:expo
   ```

   The script separately prompts for the app display name, Expo slug, URL scheme, iOS bundle identifier, and Android package name. It then lets you create or link an EAS project, verifies the resulting project and resolved Expo configuration, and writes the project ID and update URL to `app.json`. Rerunning it against an already linked app requires confirmation, and failed setup restores the local configuration files.

   Choose final, globally unique native identifiers before continuing. They identify the app in Apple and Google services and should not change after publishing. This command intentionally does not configure Firebase, Sentry, AdMob, RevenueCat, or store metadata; complete those dedicated setup steps separately.

3. Replace icons, adaptive-icon layers, splash art, and favicon under `assets/images/`, then update their references and colors in `app.json`.
4. Replace the four onboarding Lottie assets in `assets/animations/onboarding/page-1.json` through `page-4.json`. Keep those fixed filenames and the matching generic page keys so no code changes are needed.

### 2. Configure Firebase Analytics

1. Create a Firebase project and register both an iOS app and an Android app using the exact bundle ID/package name from `app.json`.
2. Download `GoogleService-Info.plist` for iOS and `google-services.json` for Android. Place them at the repository root using exactly those names; `app.json` already references them.
3. The files are intentionally Git-ignored. Provide them securely to local developers and your build environment rather than committing them.
4. Replace the sample events in `src/services/firebase/analytics/analyticsAppEvents.ts`. Keep generic lifecycle events in `analyticsGeneralEvents.ts`.

### 3. Configure RevenueCat

1. Create the RevenueCat project and add its App Store and/or Google Play app records. Configure each app's store credentials so RevenueCat can validate purchases and read its catalog.
2. Use the product-provisioning workflow below to create the store products, `premium` entitlement, default offering, and package associations.
3. For development and testing, you can use RevenueCat's Test Store API key in `AppConfig.revenueCat.iosApiKey` and `androidApiKey` in `src/configs/AppConfig.ts`.
4. Before submitting a release to the App Store or Google Play, replace the Test Store key with the correct platform-specific production API key for each field. Never submit an app configured with a Test Store key.
5. Keep `AppConfig.revenueCat.entitlementId` aligned with `revenueCat.entitlementLookupKey` in `src/configs/monetization.ts`, then replace `src/components/paywall/usePaywallFeatures.ts` and confirm the paywall and automatic-presentation behavior fit the product.

Paywall source IDs are intentionally defined beside the route or component that opens the paywall. When replacing a sample feature, replace or remove its local source ID in the same file; do not add a product-wide source registry under `src/configs/`. Route paywall navigation through `usePremiumGate` or `buildPaywallPath` so analytics attribution is retained.

Subscription access is runtime-only and resolves to `loading`, `free`, `premium`, or `unknown`. Premium actions run only for `premium`; paywalls and ads are eligible only for confirmed `free` users. Keep `loading` and `unknown` fail-closed when adapting gates or monetization flows.

### Provision store products

Store products are declared in `src/configs/monetization.ts`. Select any combination of
`weekly`, `monthly`, `yearly`, and `lifetime`; disabled products are not created or attached
to RevenueCat. Monthly is preconfigured at USD 9.99 but disabled by default. The enabled
template defaults are USD 3.99 weekly, USD 29.99 yearly, and USD 59.99 lifetime. Apple and
Google generate the initial PPP regional prices from those US anchors. Product IDs and
internal reference names remain explicit because store identifiers cannot be changed or reused
after activation.

Regional pricing uses `ppp-bands` with the required complete fixed multiplier range from `0.4`
through `1.2`, including premium bands; do not add, remove, or reorder those bands. The checked-in `world-bank-2025` snapshot combines World Bank
`PA.NUS.PPP` and `PA.NUS.FCRF` observations. For each country it selects the newest year from
2025 back through 2023 where both indicators are positive, then calculates:

```text
(country PPP conversion factor / country exchange rate)
/
(US PPP conversion factor / US exchange rate from the same year)
```

The nearest configured band wins, with the lower band winning an exact tie. The United States is
always `1.0`; ISO alpha-2 `countryOverrides` must select one of the fixed bands. Overrides for
the known App Store territories without World Bank data are supported; an unknown no-data country
is rejected rather than silently falling back. Countries without a complete indicator pair use
`1.0` with a warning. Set `strategy: 'store-equalized'` to opt out.
Economic data is never downloaded by normal monetization commands. Refresh it deliberately and
review the resulting checked-in snapshot with:

```bash
npm run monetization:ppp:refresh -- --year 2025
```

Adjusted USD anchors use integer cents with half-up rounding. Apple chooses its closest valid USD
price point (lower on a tie) and uses Apple's storefront equalizations. Google uses the `Money`
values returned by `pricing:convertRegionPrices`. Neither path post-processes local prices, so
zero-decimal currencies such as VND, JPY, and KRW retain store-native price patterns.

The optional top-level `freeTrial` selects exactly one enabled subscription for a cross-store
trial. The template defaults to a 3-day weekly trial. Set `duration` to `7-days`, `14-days`,
`1-month`, `2-months`, `3-months`, `6-months`, or `1-year` as needed; change `target` to an
enabled `monthly` or `yearly` product to move it, or set `freeTrial` to `null` to disable it.
Set the stable managed offer ID in `google.freeTrialOfferId`; it stays configured while the trial
is disabled so `monetization:activate` can identify and deactivate the previously managed offer.
Google eligibility is limited to customers who have never had any subscription in the app,
which most closely matches Apple's subscription-group eligibility. The paywall reads the
localized trial details returned by RevenueCat rather than duplicating this duration in UI copy.

The app name, iOS bundle identifier, and Android package name are read from `app.json`.
The Apple app's numeric resource ID is looked up by bundle identifier, so those values are
not duplicated in `.env.fastlane.local`.

Copy `.env.fastlane.example` to `.env.fastlane.local` and provide the App Store Connect,
Google Play, and RevenueCat API identifiers and credentials. The App Store Connect key needs
the App Manager role. The Google service account needs access to the app and permissions to
manage products and subscriptions. The RevenueCat V2 key needs read/write project-configuration
permissions for products, entitlements, offerings, and packages.
It also needs app read access. The RevenueCat App Store and Google Play app records must already
exist; the scripts find them by matching the bundle ID and package name from `app.json`, and stop
with an error when no unique match exists.

Store-product localizations are declared independently under
`fastlane/monetization/localizations/`, with one JSON file per language and explicit Apple and
Google sections. These files are the sole source for subscription-group, subscription, and
lifetime-purchase listing text; monetization setup never derives store metadata from
`src/i18n/locales/`. Review the generic premium wording for product accuracy before provisioning,
and add or remove store locale files independently from the app's runtime locale set.

Apple App Review screenshots are optional per product. Set
`appleReviewScreenshotPath` on `weekly`, `monthly`, `yearly`, and/or `lifetime`. The same local image
may be referenced by multiple products, but App Store Connect receives a separate Review Information
screenshot upload for each product. A content hash is included in the uploaded filename so
changing the local image is detected reliably.

Run the commands in this order:

```bash
npm run monetization:plan
npm run monetization:apply
npm run monetization:activate -- --confirm
npm run monetization:verify
```

`plan` does not write store state. For a new app, `apply` creates missing products directly with
their complete initial PPP matrix, reconciles mutable store metadata and RevenueCat product,
entitlement, offering, and package metadata, and creates or updates every configured localization.
RevenueCat product types, like store product IDs and purchase types, are immutable; resolve a type
conflict with a new store product identifier instead of attempting to mutate it. Apple reviewable
metadata uses the version-based App Store Connect API: an editable draft is updated in place,
or a new draft metadata version is created when the previous version is no longer editable.
Configured review screenshots are uploaded to each product's private Review Information field,
separate from its public promotional image. Google base plans and purchase
options and free-trial offers remain in draft. The setup intentionally refuses to replace an
existing regional matrix or update a live Google offer. An interrupted Apple run may leave draft
products without all prices; rerunning `apply` safely completes a matching partial matrix.
`activate` requires explicit confirmation: it
creates or replaces the configured Apple introductory free trial in every storefront, activates
the desired Google offer and base plans, and deactivates the previous managed Google trial when
the target moves.
`verify` then checks the selected catalog, localized metadata, screenshots, RevenueCat
associations, and exact live trial state. Apple products still require submission to App Review;
the first subscription group must be submitted with an app version. `activate` does not click
**Add for Review**, create an App Review submission, or submit one; manage that separately in
App Store Connect after provisioning and verification succeed.

After prices have been established, changing a `priceUsd`, PPP snapshot, band, or override uses a
separate confirmed workflow that never creates products, changes metadata, or touches RevenueCat:

```bash
npm run monetization:prices:plan
npm run monetization:prices:apply -- --confirm
npm run monetization:prices:verify
```

The plan regenerates and compares the complete regional matrix. Subscription increases preserve
existing subscriber prices on Apple and leave Google subscribers in legacy cohorts. Decreases
reach existing Apple subscribers and migrate affected Google legacy cohorts to the lower current
price. Lifetime changes affect future purchases only. Apple and Google writes are not
transactional; rerun the command to reconcile any remaining differences after a partial failure.

The setup is non-destructive. Removing a product from `enabledProducts` prevents future setup work
for it but does not delete, deactivate, or detach a product that was provisioned previously. The
only exception is the explicitly confirmed free-trial transition: this workflow owns Apple
`FREE_TRIAL` introductory offers on its configured subscriptions and the Google offer ID declared
in `freeTrial`; it replaces/removes obsolete Apple trials and deactivates obsolete managed Google
offers. Paid introductory, promotional, and unrecognized Google offers are never changed.

### 4. Configure Sentry

1. Keep the fixed-scope Sentry Organization Token as `SENTRY_AUTH_TOKEN` in the gitignored
   `.env.local` file and in the existing account- or project-level EAS environment configuration.
   Its `org:ci` scope is used only for build/update source-map uploads.
2. In Sentry Organization Settings, open **Developer Settings > Custom Integrations**, create an
   **Internal Integration**, and grant **Organization: Read**, **Team: Admin**, and **Project: Read
   & Write**. Team Admin allows project creation while the organization disables member project
   creation; it is narrower than granting Organization Write. Keep this reusable provisioning token
   in a secure machine-level environment as `SENTRY_SETUP_AUTH_TOKEN` and use the same token when
   bootstrapping future app forks. Do not add it to EAS. This template intentionally includes
   `.env.local` in EAS build archives for local-build inputs, so only place the setup token there
   temporarily and remove it before any EAS build.
3. After `npm run setup:expo` has linked the app to EAS, run:

   ```bash
   npm run setup:sentry
   ```

   The command derives the Sentry project name and slug from `expo.name` and `expo.slug`, selects an
   existing Sentry team, and idempotently creates or reuses the React Native project. It then
   retrieves or creates an active client key, writes its public DSN to `AppConfig.sentry.dsn`, and
   updates the Sentry Expo plugin's `organization`, `project`, and `url` properties in `app.json`.
   The organization is read from the existing Sentry Expo plugin configuration in `app.json`; set
   `SENTRY_ORG` in `.env.local` only to override it. A sole team is selected automatically; set
   `SENTRY_TEAM` when the organization has multiple teams. Set `SENTRY_URL` only for self-hosted
   Sentry. A normal Sentry Organization Token cannot be used for this command because Sentry fixes
   it to the `org:ci` scope.

4. Run a clean prebuild before the next local native build. A release build is still required to
   verify event delivery and native/JavaScript symbolication end to end.

EAS Build uploads source maps automatically when `SENTRY_AUTH_TOKEN` is available. The
`eas-update`, `eas-update:ios`, and `eas-update:android` commands upload the generated `dist`
source maps after a successful update. If the upload fails, the update has already been published,
but the overall command reports failure so the symbolication problem is visible.

### 5. Configure AdMob (if the app shows ads)

1. In AdMob, create an app record for each platform and copy its app ID. Add them to `AppConfig.ads.ios.appId` and `AppConfig.ads.android.appId` in `src/configs/AppConfig.ts`.
2. For each AdMob app, open **Ad units**, choose **Add ad unit**, and create the formats used by this template: one **Banner** unit and one **Interstitial** unit.
3. Copy each platform's Banner and Interstitial ad-unit IDs into the matching `bannerAdUnitId` and `interstitialAdUnitId` fields in `AppConfig.ads`.
4. Set `AppConfig.ads.enabled` to `true`, choose the `banner.enabled` and `interstitial.enabled` flags, review the interstitial completion thresholds and cooldown, then run `npm run setup:ads` to synchronize the native configuration. Keep the ads initialization hooks in the root and tabs layouts when ads are enabled; remove them when ads are disabled.
5. Development and preview builds automatically use Google's banner and interstitial test ad-unit IDs. Register any physical device used to test a production variant as an AdMob test device; never click live ads during development.
6. The template requests UMP consent before initializing Mobile Ads or constructing ad objects. Preserve that gate and configure any required Privacy & messaging forms in AdMob before release.
7. Run a clean prebuild after changing the ads configuration.

The tab layout owns one `InterstitialAdProvider`. Product completion points request an opportunity with `useRequestInterstitialAd()`; the provider applies the configured grace/completion counts, cooldown, one-ad-per-foreground cap, paywall precedence, consent/readiness, and premium-access checks. Use `canPresent` or `usePreventInterstitialAd()` to suppress presentation during product states such as active audio, recording, or another sensitive interaction.

### 6. Configure fonts, localization, and OTA updates

- **Fonts:** Change `FONT_NAME` in `src/configs/fonts.ts`, run `npm run setup:font`, then run a clean prebuild so the selected font is embedded in release builds.
- **Localization:** During product development, update only `src/i18n/locales/en.json`; missing non-English values fall back to English. Do not copy English text into other locale files. Before store submission, translate the complete current English resource for every locale the product will ship, or remove unsupported locales, then run `npm run check:i18n:release`. Run `npm run setup:i18n` after adding or removing a locale, and `npm run check:i18n` after changing English copy.
- **OTA updates:** Keep `AppConfig.otaUpdate.enabled` only when the new EAS project and update channels are ready. OTA builds and updates must share the same EAS project and runtime-version policy.

### 7. Configure app-facing settings

Replace the remaining product values in `src/configs/AppConfig.ts`:

- The iOS App Store ID once the App Store Connect record exists.
- Support email, terms-of-service URL, and privacy-policy URL.
- App-review and automatic-paywall behavior, if those template defaults do not suit the product.

### 8. Replace the template product shell

Replace the sample tabs, routes, settings preferences, onboarding pages, paywall content, analytics events, and API/query modules:

- `src/app/(tabs)/` and the tab metadata in `src/app/(tabs)/_layout.tsx`
- `src/components/onboarding/` and the four local animation slots in `assets/animations/onboarding/page-1.json` through `page-4.json`; replace those files in place without changing their generic names or page keys
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
npm run check:i18n # after changing English product copy
npm run check:i18n:release # after completing release translations
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
npm run check:i18n        # English source-locale audit
npm run check:i18n:release # All-locale release audit
npm run check             # Lint + type check
npm run test:setup-expo   # Type-check and test Expo setup tooling
npm run test:setup-sentry # Type-check and test Sentry setup tooling
npm run test:monetization # Type-check and test monetization tooling
npm run format            # Format and apply safe lint fixes

npm run prebuild:clean    # Regenerate native projects from Expo config
npm run doctor            # Expo environment diagnostics
npm run align-deps        # Align installed packages with the Expo SDK

npm run setup:expo        # Rename the app and create/link its EAS project
npm run setup:sentry      # Create/reuse the Sentry project and sync local config
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

`src/app/_layout.tsx` mounts the app-wide providers and lifecycle hooks: fonts, identity, subscriptions, RTL sync, query persistence, i18n, error boundary, navigator-aware tab insets, analytics screen tracking, OTA update checks, and snackbar rendering.

Anonymous identity is a per-variant, installation-scoped UUID stored in MMKV and shared with configured analytics, diagnostics, and subscription services. It persists across app launches and updates, but resets after uninstall/reinstall on both iOS and Android. Android Auto Backup is disabled for this barebone template; each product fork should define its own backup policy before release.

The current routes demonstrate a common paid-app shape:

- `onboarding` is shown before the persisted onboarding gate is complete.
- `(tabs)` contains four sample product tabs, each with its own navigation stack.
- `paywall` is a full-screen modal route available after onboarding.
- `debug` is a development-only diagnostic screen.

Replace, add, or remove routes to match the product. Keep provider initialization in the root layout unless an integration truly belongs to a narrower navigation scope.

### Tab Navigation

The checked-in mobile navigator uses Expo Router native tabs. Tab labels and icon metadata are declared once in `src/app/(tabs)/_layout.tsx` and shared by `NativeTabNavigator` and `CustomTabNavigator`. Native tabs use SF Symbols on iOS and Material Symbols on Android; Android supports at most five native tabs.

To switch the app back to the floating custom tab bar, change only the navigator alias import:

```ts
import { CustomTabNavigator as TabNavigator, type TabDefinition } from '@/components/base'
```

`NativeTabNavigator` resolves to `CustomTabNavigator` on web, so the existing custom web UI remains unchanged. Native tabs do not provide headers, so every tab is a folder with its own `TabStack`. Keep that structure when adding detail routes.

Expo Router does not expose native tab-bar height. `useTabBarHeight()` therefore returns the measured custom height or a conservative native fallback for root overlays. `TabNavigatorFrame` owns one persistent compact fixed-size banner above the bottom bar for both navigator implementations, so tab changes do not remount the ad or issue new requests. It publishes the measured banner height; `TabScreen` clears the combined navigator-aware inset for non-scrolling content. Scroll roots opt into `contentUnderTabBar` and add `useTabBarContentInset()` to their scroll-content bottom padding, which lets content remain visible behind the bar while keeping the final item reachable. Change `TabBarBanner` when a product needs a different policy-appropriate placement rather than mounting banners inside individual tab routes. The native bar is intentionally fixed at the bottom: iOS minimization and iPad sidebar adaptation are disabled by default.

## UI and Theme

Theme tokens live in `src/theme/`. Use `useThemedStyles(createStyles)` for themed styles and `useTheme()` for values passed to components or animation APIs. Prefer tokens for colors, spacing, typography, radius, shadows, and icon sizes.

Each theme declares an `appearance` of `light` or `dark`. Use it for appearance-dependent native props such as blur tint, and invert it when choosing status-bar content so system UI stays legible. Do not hardcode theme-dependent `light` or `dark` values in components.

The default theme uses a light surface hierarchy: `background.base` for screens, `surface` and `card` for foreground content, `subtle` for inactive controls or nested sections, and `overlay` for modal scrims. Create actual elevation by combining a surface color with a shadow token; `subtle` is not an elevation color.

Status colors are flat semantic values for icons, indicators, and borders. Derive a tinted feedback surface with `withAlpha(statusColor, 0.08)` only when a component needs one, and keep feedback text on the normal text tokens so color is not the only carrier of meaning. The status roles are `success`, `error`, `warning`, `info`, and `neutral`.

`iconSizes` is a static token and should be imported from `@/theme`; do not supply raw icon-size literals.

Font configuration lives only in `src/configs/fonts.ts`. After changing `FONT_NAME`, run:

```bash
npm run setup:font
npm run prebuild:clean
```

The template enables RTL support through Expo configuration. `useIsRTL()` is available for visuals that cannot be mirrored automatically, such as directional canvas animations.

### Reusable Components

`src/components/base/` is the reusable layer. Notable building blocks include `Button`, `Text`, `Card`, `ListItem` variants, `Toggle`, `SegmentedControl`, `BottomSheet`, `SearchInput`, `FadeScrollView`, `Snackbar`, `CollapsingHeader`, `NativeTabNavigator`, `CustomTabNavigator`, `TabStack`, `TabScreen`, `FloatingTabBar`, `Onboarding`, `Paywall`, and loading indicators.

Expo UI wrappers live in `src/components/base/NativeUI/` and use PascalCase `Native*` names such as `NativeToggle`, `NativeBottomSheet`, and `NativeAlertDialog`. They preserve the custom base components for side-by-side comparison, expose platform-neutral props, inherit the app theme and RTL direction where supported, and target iOS and Android only.

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
  setValue: (value) =>
    set((state: AppSlices) => {
      state.example.value = value
    }),
})

export const sliceConfig = {
  create: createExampleSlice,
  persistExcludeKeys: examplePersistExcludeKeys,
} satisfies SliceConfig<ExampleSlice>

export const useExampleState = () =>
  getUseAppStore()(
    useShallow(({ example }) => ({ value: example.value, setValue: example.setValue }))
  )
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

During product development, treat `src/i18n/locales/en.json` as the only source locale. Add and revise copy there, then run `npm run check:i18n`. The command checks English key usage and empty values while intentionally ignoring every non-English locale. Do not copy English values into other locale files to make their keys match; missing translations use the English fallback.

Before publishing a product fork, translate the complete current English resource into every locale the product will ship. Preserve interpolation placeholders, review translation quality, remove locale files for languages the product will not support, and run `npm run check:i18n:release` to verify key coverage, non-empty values, and placeholders across every configured locale. To add or remove a locale, update its JSON resource and run `npm run setup:i18n` to synchronize `app.json`.

The i18n configuration includes `number` and `currency` formatters for products that need them, but neither is a requirement of the template.

## Build and Release

EAS profiles are defined in `eas.json`. Common production commands are `npm run eas-build`, `npm run eas-build:ios:submit`, `npm run eas-build:android:submit`, and `npm run eas-update`. The EAS Update commands publish only when the update succeeds, then upload the generated `dist` source maps to Sentry.

Fastlane at the repository root manages App Store Connect and Google Play listing metadata and screenshots. It reads the bundle identifier and package name from `app.json`; update its shared URLs, locale folders, and credentials for each new app before running the `fastlane:*` scripts. Keep secrets and reviewer contact information out of Git.

Store-product provisioning uses the official App Store Connect, Android Publisher, and RevenueCat
APIs through the `monetization:*` commands above. Fastlane remains responsible for listing metadata,
screenshots, and release tasks.

## Verification

At a minimum, run `npm run check` after code changes and `npm run check:i18n` after changing English product copy. The standard check intentionally covers only linting and the app TypeScript check. Run `npm run test:setup-expo` after changing the Expo setup tooling, `npm run test:setup-sentry` after changing the Sentry setup tooling, and `npm run test:monetization` after changing `scripts/monetization/` or `src/configs/monetization.ts`; each domain command includes its TypeScript check. For native dependency or configuration changes, also run `npm run prebuild:clean` and test the affected platform.
