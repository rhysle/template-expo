# Currency Converter

A React Native app built with Expo for converting currencies, browsing rates, and managing query preferences.

## Stack

- Expo + React Native + Expo Router
- TypeScript
- MMKV for local persistence
- Phosphor (`phosphor-react-native`) for icons — default weight `regular`, active tab icons use `fill`

## Project Structure

- `src/app/`: routes and screens (Expo Router).
- `src/components/`: shared UI components.
- `src/constants/`: app constants and static config.
- `src/stores/`: client state (Zustand slices + selectors).
- `src/services/queries/`: server state — each domain file (`rates.ts`, `timeSeries.ts`) owns its full stack: fetch function → query keys → query options → hooks. `queries/provider/` contains template infrastructure (TanStack Query provider + persistence).
- `src/storage/`: local persistence by domain.
- `src/types/`: shared TypeScript types.
- `src/utils/`: shared utilities. `network.ts` provides `assertOnline` and `getEmulatorHost` used by query files. `color.ts` provides `withAlpha(hex, alpha)` for applying opacity to hex colors.
- `src/constants/`: app-wide constants. `layout.ts` exports `TAB_BAR_HEIGHT` (80 pt initial/fallback value).

## Fonts

Font configuration lives in `src/configs/fonts.ts` — the single source of truth for the app's typeface.

| Symbol                           | Purpose                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `FONT_NAME`                      | PascalCase Google Font name (e.g. `'OpenSans'`)                                                                    |
| `fontFamilyMap`                  | Maps semantic weights (`light` / `regular` / `medium` / `semibold` / `bold`) to font family strings                |
| `getFontFamilyForLanguage(lang)` | Returns `fontFamilyMap` for Latin-script locales; returns all-`undefined` map for others → OS system font fallback |

### Font service (`src/services/fonts/`)

`useLoadFonts()` — called in `RootLayout`. Keeps the splash screen visible until fonts are ready.

- **Dev:** loads fonts over the network from `@expo-google-fonts/dev` (no rebuild needed)
- **Prod:** no-op — fonts are natively embedded via the `expo-font` config plugin

### Changing the font

1. Update `FONT_NAME` in `src/configs/fonts.ts`
2. Run the setup script — installs the Google Fonts package and patches `app.json`:
   ```bash
   npx tsx scripts/setup-font.ts
   ```
3. Rebuild native project to embed fonts:
   ```bash
   npx expo prebuild --clean
   ```

### Typography tokens

`t.typography.fontFamily` is typed as `ResolvedFontFamilyMap` (either `fontFamilyMap` or `Record<FontWeight, undefined>`). Always set both `fontFamily` **and** `fontWeight` together — React Native requires the per-weight font file to be specified explicitly; setting `fontWeight` alone has no effect when a custom font is loaded.

### Icon sizes

`iconSizes` is a **static token** (not on the `ResolvedTheme` from `useTheme()`) — import it directly:

```ts
import { iconSizes } from '@/theme'
```

| Key    | Value | Typical use                         |
| ------ | ----- | ----------------------------------- |
| `xs`   | 12    | Micro badges, small lock indicators |
| `sm`   | 16    | Chevrons, nav items, checkmarks     |
| `md`   | 20    | Settings rows, feature icons        |
| `lg`   | 24    | Tab bar, close buttons, keyboards   |
| `xl`   | 40    | Empty states                        |
| `hero` | 80    | Onboarding hero                     |

Always pass `iconSizes.*` to icon `size` props — never hardcode numbers.

---

## State Management

Client state uses [Zustand](https://zustand.dev/) with [Immer](https://immerjs.github.io/immer/) (mutative updates) and MMKV persistence. State is split into slice files that are **auto-discovered at runtime** — adding a new slice only requires creating one file.

### Structure

- `src/stores/features/`: one file per slice (`converter.ts`, `theme.ts`, `preferences.ts`, …)
- `src/stores/slices/index.ts`: auto-discovers all feature files via `require.context` and assembles the store
- `src/stores/slices/types.ts`: shared types (`SliceConfig<T>`, `AppPersistedState`) and `getUseAppStore` lazy accessor
- `src/stores/slices/persist.ts`: type utilities (`NonFunctionKeys<T>`, `PersistedState<T>`)
- `src/stores/global.d.ts`: seeds the global `interface AppSlices {}`
- `src/stores/appStore.ts`: creates the Zustand store
- `src/stores/index.ts`: public re-export

### Adding a New Slice

Create `src/stores/features/xxx.ts` — nothing else is required:

```ts
import { useShallow } from 'zustand/react/shallow'
import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    xxx: XxxSlice
  }
}

export interface XxxSlice {
  /* state + actions */
}

export const xxxPersistExcludeKeys: ExcludeKeys<XxxSlice> = []

export const createXxxSlice = (set: any, get: any): XxxSlice => ({/* ... */})

export const sliceConfig = {
  create: createXxxSlice,
  persistExcludeKeys: xxxPersistExcludeKeys,
  // Add version + migrations only when migrating previously-shipped persisted data
  // version: 1,
  // migrations: { 1: (state) => ({ newField: 'default' }) },  // state is Partial<XxxSlice>
} satisfies SliceConfig<XxxSlice>

export const useXxxState = () =>
  getUseAppStore()(useShallow(({ xxx }) => ({/* pick fields from xxx */})))
```

Keys listed in `persistExcludeKeys` are excluded from MMKV persistence. Import the hook directly from the feature file:

```ts
import { useConverterState } from '@/stores/features/converter'
```

### Per-Feature Migrations

Each slice can declare a `version` and a `migrations` map in its `sliceConfig`. On rehydration, only the migrations needed to bring that feature up to its current version are applied — features are versioned independently and don't affect each other. The `_sliceVersions` record inside the persisted state blob tracks the version of each feature.

## Storage Architecture

Storage is organized by adapter/persister so state and query layers can persist to MMKV.

### Structure

- `src/storage/core/`: reusable primitives (MMKV engine, key namespacing, serialization, contracts).
- `src/storage/queryStorage.ts`: TanStack Query async persister adapter.
- `src/storage/storeStorage.ts`: Zustand persist storage adapter.
- `src/storage/index.ts`: single public entrypoint used by the rest of the app.

### Key Naming Convention

MMKV keys follow the `namespace.name` pattern — the namespace prefix is applied automatically by each storage adapter. Current keys:

| Key             | Written by                                |
| --------------- | ----------------------------------------- |
| `zustand.state` | `storeStorage` (Zustand persist adapter)  |
| `query.state`   | `queryStorage` (TanStack Query persister) |

Use `buildStoreKey` / `buildQueryKey` from the respective storage modules to derive keys in code — never hardcode the full key string.

### Add a New Storage Domain

1. Create `src/storage/<feature>Storage.ts` adapter.
2. Declare a local namespace key (for example `createNamespaceKey('rates')`) and register it with `registerStorageNamespace(...)` for duplicate checks in development.
3. Export the domain module from `src/storage/index.ts`.

Guideline: keep domain modules focused and avoid importing app config directly when values can be passed in by callers.

## Onboarding Flow

The app shows an onboarding flow on first launch. It is split into a **reusable core** and **app-specific content**:

### Reusable Core (`src/components/base/Onboarding/`)

Template-ready components that handle navigation, animation, pagination, and gestures. Keep these intact when reusing in other projects.

| File                     | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `types.ts`               | `OnboardingPageItem` and `OnboardingFlowProps` interfaces              |
| `OnboardingFlow.tsx`     | Main container — manages fade animation, swipe gesture, and pagination |
| `OnboardingPage.tsx`     | Per-page fade wrapper driven by a shared `currentIndex` value          |
| `PaginationDots.tsx`     | Animated pill-shaped dot indicator                                     |
| `OnboardingControls.tsx` | Skip / Next / Done button bar                                          |

**Props:**

```tsx
<OnboardingFlow
  pages={pages} // OnboardingPageItem[] — app-specific
  swipeEnabled // boolean, default true
  animationType="slide" // 'slide' (default) | 'fade'
  onComplete={handleComplete}
  onSkip={handleSkip} // optional, defaults to onComplete
/>
```

### App-Specific Content (`src/components/onboarding/`)

Swap only these files when reusing the core in another project:

- `onboardingPages.tsx` — defines the array of `OnboardingPageItem` (key + ReactNode content)
- `OnboardingScreenContent.tsx` — shared icon + title + description layout for each screen

### State (`src/stores/features/onboarding.ts`)

Auto-discovered Zustand slice persisted to MMKV:

```ts
import { useOnboardingState } from '@/stores/features/onboarding'

const { hasCompletedOnboarding, completeOnboarding, resetOnboarding } = useOnboardingState()
```

`resetOnboarding()` is useful in dev/debug flows to re-trigger the onboarding.

### Gating

`src/app/_layout.tsx` uses `Stack.Protected guard={hasCompletedOnboarding}` to gate the `(tabs)`, `paywall`, and `debug` routes. A second `Stack.Protected guard={!hasCompletedOnboarding}` exposes only the `onboarding` screen until onboarding completes. MMKV is synchronous so there is no hydration flash.

---

## Paywall

After onboarding completes, a paywall is shown (skipped if already subscribed). It is split into a **reusable core** and **app-specific usage**:

### Reusable Core (`src/components/base/Paywall/`)

Template-ready components and hooks. Keep these intact when reusing in other projects.

| File                    | Purpose                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `types.ts`              | `PaywallFeatureItem`, `PaywallCallbacks`, `PaywallScreenProps`                                |
| `PaywallScreen.tsx`     | Full paywall UI — hero, features, packages, subscribe/restore                                 |
| `PackageOption.tsx`     | Selectable subscription package card with free-trial and savings-percent badges               |
| `savings.ts`            | `getPeriodKey`, `computeYearlySavingsPercent` — period parsing and yearly savings calculation |
| `PaywallFeatureRow.tsx` | Icon + title + description feature row                                                        |
| `PaywallHero.tsx`       | App icon hero image                                                                           |
| `usePaywall.ts`         | Hook that loads offerings, handles purchase and restore flows                                 |
| `index.ts`              | Exports `PaywallScreen` and types                                                             |

**Props:**

```tsx
<PaywallScreen
  title="Go Premium"
  subtitle="Unlock everything"
  features={features} // PaywallFeatureItem[]
  onComplete={fn} // called after subscribe or dismiss
  onDismiss={fn} // called when user taps close
  onSubscribeSuccess={fn} // optional callbacks
  onSubscribeError={fn}
  onRestoreSuccess={fn}
  onRestoreNoSubscription={fn}
  onRestoreError={fn}
/>
```

### RevenueCat Service (`src/services/revenueCat/`)

Wraps `react-native-purchases`. Configured via `AppConfig.revenueCat` (API keys + entitlement ID).

- `revenueCatService.ts` — `initRevenueCat`, `fetchOfferings`, `purchasePackage`, `restorePurchases`, `checkEntitlement`, `getActiveEntitlementId`, `addCustomerInfoListener`, `getCustomerInfo`
- `useRevenueCatInit.ts` — hook replacement for the former `RevenueCatProvider`. Reads `userId` from the `userIdentity` slice internally; no-op while null. Once userId is ready: calls `initRevenueCat(userId)`, refreshes subscription status, attaches customer info listener and AppState listener. Call once in `RootLayout`.
- `index.ts` — barrel exports

`useRevenueCatInit()` is called in `RootLayout` in `src/app/_layout.tsx`. It reads `userId` from the `userIdentity` slice and is a no-op until it is non-null (i.e., after `useUserIdentityInit` resolves).

### Subscription State (`src/stores/features/subscription.ts`)

Auto-discovered Zustand slice. All fields excluded from MMKV persistence — status is refreshed from RevenueCat on every cold start and foreground resume.

```ts
import { useSubscriptionState } from '@/stores/features/subscription'

const { isSubscribed, activeEntitlementId, setSubscriptionStatus } = useSubscriptionState()
```

### App Config (`src/configs/index.ts`)

`AppConfig` now includes:

```ts
AppConfig.revenueCat.iosApiKey
AppConfig.revenueCat.androidApiKey
AppConfig.revenueCat.entitlementId
AppConfig.iosAppStoreId
AppConfig.support.email
AppConfig.links.termsOfService
AppConfig.links.privacyPolicy
```

### Paywall Screen (`src/app/paywall.tsx`)

A `fullScreenModal` screen that shows `PaywallScreen` mid-app (for example, when a trial expires or via the `PromoBanner`). Navigate to it from anywhere inside the protected stack:

```ts
router.push('/paywall')
```

It navigates back on complete or dismiss.

### Paywall State (`src/stores/features/paywall.ts`)

Auto-discovered Zustand slice that tracks timing for the auto-paywall feature.

| Field                      | Purpose                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `autoPaywallEnabledAt`     | Timestamp (ms) when the auto-paywall window was first opened (`null` until initialised)     |
| `autoPaywallLastShownAt`   | Timestamp (ms) of the last time the auto-paywall was shown                                  |
| `initAutoPaywallEnabled()` | Sets `autoPaywallEnabledAt` to `Date.now()` once (no-op on subsequent calls)                |
| `recordAutoPaywallShown()` | Updates `autoPaywallLastShownAt` to `Date.now()`                                            |
| `isAutoPaywallShowing`     | `true` while the auto-paywall screen is visible (not persisted); read by interstitial guard |
| `setAutoPaywallShowing()`  | Set by `useAutoPaywall` on open/close                                                       |

---

## CollapsingHeader

An animated compact header bar that fades in and slides down as the user scrolls. The background transitions from fully transparent to `colors.background.base` via `interpolateColor`. Hides the Expo Router native header (`headerShown: false`).

### Component (`src/components/base/CollapsingHeader/CollapsingHeader.tsx`)

| Prop           | Type                  | Default | Description                                     |
| -------------- | --------------------- | ------- | ----------------------------------------------- |
| `title`        | `string`              | —       | Text shown in the compact bar                   |
| `scrollOffset` | `SharedValue<number>` | —       | From `useCollapsingHeader`                      |
| `right?`       | `ReactNode`           | —       | Optional button anchored to the right           |
| `threshold?`   | `number`              | `60`    | Scroll distance (px) to complete the transition |

### Hook (`useCollapsingHeader`)

```ts
const { scrollOffset, largeTitleAnimatedStyle, onScrollOffsetChange, scrollHandler, headerHeight } =
  useCollapsingHeader({ threshold?, headerInset? })
```

- **`scrollOffset`** — pass to `<CollapsingHeader scrollOffset={scrollOffset} />`
- **`largeTitleAnimatedStyle`** — apply to your large on-screen title so it fades out as the compact bar fades in
- **`headerHeight`** (`insets.top + 44`) — use as `paddingTop` on the scroll content container so content starts below the header
- **`onScrollOffsetChange`** — for `DraggableFlatList` (JS thread callback)
- **`scrollHandler`** — for `Animated.ScrollView` (UI thread); pair with `scrollEventThrottle={16}`
- **`headerInset?: boolean`** — pass `true` when the scroll view uses `contentInset.top = headerHeight` on iOS (e.g. `DraggableFlatList`). The hook normalises the offset automatically so the large title fades at the right point.

### Usage

```tsx
// In the screen's Stack.Screen options:
// <Stack.Screen options={{ headerShown: false }} />

const { scrollOffset, largeTitleAnimatedStyle, scrollHandler, headerHeight } = useCollapsingHeader()

<CollapsingHeader title="Screen Title" scrollOffset={scrollOffset} />

<Animated.ScrollView
  onScroll={scrollHandler}
  scrollEventThrottle={16}
  contentContainerStyle={{ paddingTop: headerHeight }}>
  {/* large title */}
  <Animated.Text style={largeTitleAnimatedStyle}>Screen Title</Animated.Text>
  {/* content */}
</Animated.ScrollView>
```

---

## Snackbar System

A lightweight in-app notification system.

- **`Snackbar`** (`src/components/base/Snackbar.tsx`) — presentational animated bar shown at the bottom of the screen.
- **`SnackbarHost`** (`src/components/SnackbarHost.tsx`) — drives `<Snackbar>` from the `snackbar` Zustand slice, handles auto-dismiss. Mounted once in `RootLayoutContent` (`_layout.tsx`).
- **`snackbar` slice** (`src/stores/features/snackbar.ts`) — auto-discovered slice.

```ts
import { useSnackbarState } from '@/stores/features/snackbar'

const { showSnackbar, hideSnackbar } = useSnackbarState()

showSnackbar({
  title: 'Saved!',
  subtitle: 'Changes will sync shortly', // optional
  icon: CheckCircleIcon, // optional: Icon | null (null forces no icon)
  variant: 'success', // 'default' | 'success' | 'error' | 'warning' | 'neutral'
  durationMs: 4000, // optional; ≤ 0 persists until manually dismissed
  action: { label: 'Undo', onPress: fn }, // optional
  bottomOffset: 0, // optional numeric override
})
```

The `snackbar` state field is excluded from MMKV persistence.

## App Review

- `src/services/storeReview/useAppReview.ts` triggers the automatic in-app rating prompt using `expo-store-review.requestReview()` with local gating state (`src/stores/features/appReview.ts`).
- `src/services/storeReview/storeReviewService.ts` also exposes `openWriteReview()` for a guaranteed manual path from Settings.
- On iOS, `openWriteReview()` uses `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id{iosAppStoreId}?action=write-review` from `AppConfig.iosAppStoreId`.
- On Android, `openWriteReview()` derives the package name from Expo config (`Constants.expoConfig?.android?.package`) and opens the Play Store URL for that package.
- Failures in `openWriteReview()` are logged to Sentry and do not show snackbar fallback.
- `src/app/(tabs)/settings.tsx` wires `Rate App` to this manual flow.

---

## Firebase Analytics

Service layer: `src/services/firebase/` — follows the same pattern as `revenueCat/`.

| File                              | Purpose                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `analytics/analyticsService.ts`   | `trackEvent`, `trackScreenView`, `setAnalyticsUserId`, `setAnalyticsUserProperties`         |
| `analytics/analyticsEvents.ts`    | Generic template events (onboarding, paywall, errors) — do not add app-specific events here |
| `analytics/analyticsAppEvents.ts` | App-specific events — replace entirely when forking for a new project                       |
| `analytics/types.ts`              | `AnalyticsEventName` union type                                                             |
| `analytics/useScreenTracker.ts`   | Auto screen tracking hook                                                                   |

```ts
import {
  trackEvent,
  AnalyticsEvents,
  AppAnalyticsEvents,
  setAnalyticsUserProperties,
} from '@/services/firebase/analytics'

trackEvent(AnalyticsEvents.PAYWALL_VIEWED)
trackEvent(AppAnalyticsEvents.CURRENCY_ADDED, { code: 'USD' })
setAnalyticsUserProperties({ app_version: '1.0.0' }) // string values only
```

Screen tracking is automatic — `useScreenTracker()` is called in `RootLayoutContent` in `_layout.tsx`.

`setAnalyticsUserProperties` is called at module level in `_layout.tsx` to set `app_version` on every cold start. Firebase Analytics requires string values; properties persist across sessions until overwritten.

Replace native config files when deploying:

- iOS: `ios/<appname>/GoogleService-Info.plist`
- Android: `android/app/google-services.json`

---

## User Identity

Service layer: `src/services/userIdentity/`.

Generates a stable anonymous UUID on first cold start and propagates it to Sentry, RevenueCat, and Firebase Analytics. No authentication — the ID is anonymous and device-bound.

**Storage:** `expo-secure-store` (`Keychain` on iOS → survives app uninstall; `EncryptedSharedPreferences` on Android → reset on reinstall, acceptable since purchase restoration works independently via store receipts).

**Variant isolation:** All build variants share the same bundle ID / package name, so SecureStore is keyed per variant to prevent dev / preview / production user IDs from colliding in analytics and RevenueCat. Key format: `user.identity.${APP_VARIANT}` (e.g. `user.identity.development`, `user.identity.preview`, `user.identity.production`). The variant is read from `process.env.APP_VARIANT` at bundle time. Sentry is already `enabled: !__DEV__`, so Sentry user IDs are a no-op in dev.

| File                     | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `userIdentityService.ts` | `getOrCreateUserId()`, `clearUserId()`                                     |
| `useUserIdentityInit.ts` | One-time init hook; reads/generates the ID, sets slice + Sentry + Firebase |
| `index.ts`               | Barrel exports                                                             |

**Zustand slice** (`src/stores/features/userIdentity.ts`): auto-discovered. Fields: `userId` (excluded from MMKV persistence — SecureStore is the source of truth), `setUserId`, `clearUserId`.

```ts
import { useUserIdentityState } from '@/stores/features/userIdentity'

const { userId } = useUserIdentityState()
```

**Initialization flow** (`src/app/_layout.tsx`):

```ts
// In RootLayout:
useUserIdentityInit() // loads ID async → sets slice + Sentry + Firebase
useRevenueCatInit() // no-op until userId is ready
```

**Settings:** The current `userId` is displayed in the About card on the Settings screen. Tapping it copies it to the clipboard.

**Debug screen:** Displays the current `userId` and has a "Reset User ID" button that clears SecureStore + the slice. The next cold start generates a fresh ID.

---

## Sentry (Error Tracking)

Service layer: `src/services/sentry/`.

```ts
import { recordError, logBreadcrumb, setSentryUser, setSentryTag } from '@/services/sentry'
```

`initSentry()` is called at module level in `_layout.tsx` (before any component renders). Disabled in dev (`enabled: !__DEV__`).

DSN is configured via `AppConfig.sentry.dsn` in `src/configs/index.ts`.

---

## Ads (AdMob)

Service layer: `src/services/ads/`. Ads are **disabled by default** in the template. The library (`react-native-google-mobile-ads`) is installed but excluded from both the native build and the JS bundle until you opt in.

### Configuration (`src/configs/index.ts`)

```ts
AppConfig.ads.enabled          // master toggle
AppConfig.ads.ios.appId        // AdMob iOS App ID
AppConfig.ads.ios.bannerAdUnitId
AppConfig.ads.ios.interstitialAdUnitId
AppConfig.ads.android.*        // same shape for Android
AppConfig.ads.interstitial.gracePeriodSessions   // sessions before first interstitial (default: 3)
AppConfig.ads.interstitial.cooldownMs            // min ms between shows (default: 4 hours)
```

### How exclusion works

| Layer                       | Mechanism                                                                                                               | Controlled by       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Native (CocoaPods / Gradle) | `expo.autolinking.exclude` in `package.json` for both `react-native-google-mobile-ads` and `expo-tracking-transparency` | `npm run setup:ads` |
| JS bundle                   | Not importing `useAdsInit()` / `useConsentInit()` in layout files                                                       | Developer action    |

### Enabling ads

1. Set `AppConfig.ads.enabled = true` and fill in all App IDs and ad unit IDs in `src/configs/index.ts`
2. Run the setup script — removes both packages from autolinking exclude, adds both native plugins to `app.json`:
   ```bash
   npm run setup:ads
   ```
3. Add `useAdsInit()` inside `RootLayout` in `src/app/_layout.tsx`:
   ```ts
   import { useAdsInit } from '@/services/ads'
   // inside RootLayout function body:
   useAdsInit()
   ```
4. Add `useConsentInit()` inside `TabLayout` in `src/app/(tabs)/_layout.tsx`:
   ```ts
   import { useConsentInit } from '@/services/ads'
   // inside TabLayout function body:
   useConsentInit()
   ```
5. Add `useInterstitialAdInit()` inside `TabLayout` in `src/app/(tabs)/_layout.tsx`:
   ```ts
   import { useInterstitialAdInit } from '@/services/ads'
   // inside TabLayout function body:
   useInterstitialAdInit()
   ```
6. Rebuild native project:
   ```bash
   npx expo prebuild --clean
   ```

### Disabling ads

1. Set `AppConfig.ads.enabled = false`
2. Run `npm run setup:ads` — adds both packages to autolinking exclude, removes both native plugins from `app.json`
3. Remove the `useAdsInit()` call from `src/app/_layout.tsx`
4. Remove the `useConsentInit()` call from `src/app/(tabs)/_layout.tsx`
5. Remove the `useInterstitialAdInit()` call from `src/app/(tabs)/_layout.tsx`
6. Run `npx expo prebuild --clean`

### Placing ads

All ad components and hooks are imported from `@/services/ads`. They automatically return `null` / no-op when ads are disabled or the user is subscribed.

**Banner ad** — one line:

```tsx
import { BannerAd } from '@/services/ads'

<BannerAd />                          // default BANNER size
<BannerAd size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
```

**Interstitial ad:**

```tsx
import { useInterstitialAd } from '@/services/ads'

const { show, isLoaded } = useInterstitialAd()

<Button onPress={show} disabled={!isLoaded} title="Next" />
```

`show()` returns `false` silently if the grace period hasn't elapsed, the cooldown is active, or the auto-paywall is currently visible. No caller-side guard is needed.

### Ads state (`src/stores/features/ads.ts`)

Auto-discovered Zustand slice. Tracks SDK initialization status — useful for conditional UI while the SDK is loading.

```ts
import { useAdsState } from '@/stores/features/ads'

const { adsInitialized, adsInitError, consentGathered, privacyOptionsRequired } = useAdsState()
```

---

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npx expo start
```

Then run the app in one of the available targets (iOS simulator, Android emulator, or Expo Go).

## Supported Languages

The app ships with 33 UI locales. Language is resolved from the device system setting — no in-app picker. Fallback: English.

| #   | Code      | Language              | Script     | Direction |
| --- | --------- | --------------------- | ---------- | --------- |
| 1   | `ar`      | Arabic                | Arabic     | RTL       |
| 2   | `bn`      | Bangla                | Bengali    | LTR       |
| 3   | `cs`      | Czech                 | Latin      | LTR       |
| 4   | `da`      | Danish                | Latin      | LTR       |
| 5   | `de`      | German                | Latin      | LTR       |
| 6   | `el`      | Greek                 | Greek      | LTR       |
| 7   | `en`      | English               | Latin      | LTR       |
| 8   | `es`      | Spanish               | Latin      | LTR       |
| 9   | `fi`      | Finnish               | Latin      | LTR       |
| 10  | `fr`      | French                | Latin      | LTR       |
| 11  | `he`      | Hebrew                | Hebrew     | RTL       |
| 12  | `hi`      | Hindi                 | Devanagari | LTR       |
| 13  | `hr`      | Croatian              | Latin      | LTR       |
| 14  | `hu`      | Hungarian             | Latin      | LTR       |
| 15  | `id`      | Indonesian            | Latin      | LTR       |
| 16  | `it`      | Italian               | Latin      | LTR       |
| 17  | `ja`      | Japanese              | Japanese   | LTR       |
| 18  | `ko`      | Korean                | Hangul     | LTR       |
| 19  | `ms`      | Malay                 | Latin      | LTR       |
| 20  | `nl`      | Dutch                 | Latin      | LTR       |
| 21  | `nb`      | Norwegian             | Latin      | LTR       |
| 22  | `pl`      | Polish                | Latin      | LTR       |
| 23  | `pt-BR`   | Portuguese (Brazil)   | Latin      | LTR       |
| 24  | `pt`      | Portuguese (Portugal) | Latin      | LTR       |
| 25  | `ro`      | Romanian              | Latin      | LTR       |
| 26  | `ru`      | Russian               | Cyrillic   | LTR       |
| 27  | `sv`      | Swedish               | Latin      | LTR       |
| 28  | `th`      | Thai                  | Thai       | LTR       |
| 29  | `tr`      | Turkish               | Latin      | LTR       |
| 30  | `uk`      | Ukrainian             | Cyrillic   | LTR       |
| 31  | `vi`      | Vietnamese            | Latin      | LTR       |
| 32  | `zh-Hans` | Chinese (Simplified)  | Chinese    | LTR       |
| 33  | `zh-Hant` | Chinese (Traditional) | Chinese    | LTR       |

---

## i18n (Internationalization)

Uses [i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/) with full TypeScript type safety (autocomplete and compile-time errors for invalid keys).

### Structure

```
src/i18n/
  config.ts          # i18next initialization + custom formatters
  resources.ts       # Assembles all locale files
  types.ts           # TypeScript module augmentation
  locales/
    en.json          # English (base)
    de.json  es.json  fr.json  hi.json  id.json  it.json
    ja.json  ko.json  pt-BR.json  ru.json  th.json  tr.json
    vi.json  zh-Hans.json  zh-Hant.json
```

### Usage in Components

```tsx
import { useTranslation } from 'react-i18next'

const MyComponent = () => {
  const { t } = useTranslation()
  return <Text>{t('settings.title')}</Text>
}
```

### Adding a Translation Key

1. Add the key to `src/i18n/locales/en.json` (and all other locale files)
2. Use in component: `t('section.key')` or with interpolation: `t('section.key', { name: 'World' })`

### Plurals

```json
{ "items": { "count_one": "{{count}} item", "count_other": "{{count}} items" } }
```

```tsx
t('items.count', { count: 5 }) // "5 items"
```

### Number Formatting

```json
{ "total": "Total: {{value, number}}" }
```

```tsx
t('total', { value: 1234.56 }) // "Total: 1,234.56" (en) / "Total: 1.234,56" (vi)
```

### Currency Formatting

```json
{ "price": "{{value, currency}}" }
```

```tsx
t('price', { value: 42.5, currency: 'USD' }) // "$42.50"
```

### Adding a New Language

1. Create `src/i18n/locales/xx.json` with the same key structure as `en.json` (omit `currencies.*`)
2. Run `npm run generate:currencies` to populate `currencies.*` for the new locale
3. Run `npm run setup:i18n` to add the locale code to `supportedLocales` in `app.json`
4. Run `npm run check:i18n` to verify key parity

### Auditing Translation Keys

```bash
npm run check:i18n                     # report unused keys and locale mismatches
npm run check:i18n -- --remove-unused  # auto-remove unused keys from all locale files
```

`--remove-unused` deletes every unused leaf key from all locale files. If removing a leaf leaves its parent object empty, the parent object is also removed.

> **Note:** `currencies.*` keys are auto-generated by `scripts/generate-currency-names.ts` and are excluded from the unused-key check. Do not add or edit them manually.

### Language Resolution Order

1. Device locale (`expo-localization`)
2. Fallback: English

---

## Store Metadata (Fastlane)

Store listing metadata (descriptions, screenshots, release notes) for both App Store Connect and Google Play is managed via **Fastlane**, configured at the repo root so the setup survives `expo prebuild --clean`.

### Prerequisites

Install Fastlane (macOS):

```bash
brew install fastlane
```

### Credentials

1. Copy the credentials template:
   ```bash
   cp .env.fastlane.example .env.fastlane.local
   ```
2. **iOS review contact** — `fastlane/ios/metadata/review_information/` is gitignored. Create the files locally before running the iOS lane:
   ```bash
   mkdir -p fastlane/ios/metadata/review_information
   echo "Your Name"     > fastlane/ios/metadata/review_information/first_name.txt
   echo "Your Surname"  > fastlane/ios/metadata/review_information/last_name.txt
   echo "you@example.com" > fastlane/ios/metadata/review_information/email_address.txt
   echo "+1234567890"   > fastlane/ios/metadata/review_information/phone_number.txt
   touch fastlane/ios/metadata/review_information/demo_user.txt
   touch fastlane/ios/metadata/review_information/demo_password.txt
   touch fastlane/ios/metadata/review_information/notes.txt
   ```
3. **iOS API key** — create an App Store Connect API key (`App Manager` role) in App Store Connect → Users and Access → Keys. Download the `.p8` file into `fastlane/.private/` and fill in `APP_STORE_CONNECT_API_KEY_KEY_ID`, `APP_STORE_CONNECT_API_KEY_ISSUER_ID`, and `APP_STORE_CONNECT_API_KEY_KEY_FILEPATH` in `.env.fastlane.local`.
4. **Android** — create a Google Play service account (Google Cloud Console → IAM → Service Accounts), grant it metadata/listing permissions in the Play Console, download the JSON key into `fastlane/.private/`, and set `GOOGLE_PLAY_JSON_KEY_PATH` in `.env.fastlane.local`.

### npm Scripts

| Command                                      | Purpose                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run fastlane:ios:init`                  | One-shot: pull live ASC listing into `fastlane/ios/metadata`                                                                           |
| `npm run fastlane:ios:metadata`              | Push all locales to App Store Connect                                                                                                  |
| `npm run fastlane:ios:metadata:globals`      | Push only non-localized globals (categories, copyright, `review_information`, `app_rating_config`); skips locales + screenshots — fast |
| `npm run fastlane:ios:metadata:test`         | Push only `en-US` + `vi` (verify before full rollout)                                                                                  |
| `npm run fastlane:android:init`              | One-shot: pull live Play listing into `fastlane/android/metadata`                                                                      |
| `npm run fastlane:android:metadata`          | Push all locales to Google Play                                                                                                        |
| `npm run fastlane:android:metadata:test`     | Push only `en-US` + `vi`                                                                                                               |
| `npm run fastlane:android:metadata:validate` | Google Play dry-run — validates without committing changes                                                                             |

None of the `:metadata` commands upload a binary — only listing content. Safe to run against a published version.
