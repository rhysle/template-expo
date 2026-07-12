# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

- App: Expo SDK 55 + React Native 0.83 + React 19.2 with React Compiler (no manual `useMemo`/`useCallback` needed)
- Language: TypeScript (`strict`)
- Routing: Expo Router (file-based)
- Data fetching/cache: TanStack Query v5 + MMKV persistence
- Backend API: Firebase Cloud Functions (fetch functions live in `src/services/queries/*.ts`)

## Common Commands

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npm run ios:device     # Run on physical iOS device
npm run android:device # Run on physical Android device
npm run web            # Run web app

npm run lint           # ESLint
npm run check:type     # TypeScript checks (no emit)
npm run check:i18n                    # i18n check for mismatch or unused translation keys
npm run check:i18n -- --remove-unused # auto-remove unused keys from all locale files
npm run setup:i18n     # sync supportedLocales in app.json from src/i18n/locales/
npm run generate:currencies  # populate currencies.* in all locale files
npm run check          # Lint + typecheck + i18n
npm run format         # Prettier

npm run prebuild       # Generate native iOS/Android project files
npm run prebuild:clean # Clean and regenerate native files
npm run eas-build      # EAS build for all platforms
npm run eas-build:ios:submit     # EAS build iOS production + auto-submit to App Store
npm run eas-build:android:submit # EAS build Android production + auto-submit to Google Play
npm run eas-submit:ios           # Submit an existing iOS build to App Store
npm run eas-submit:android       # Submit an existing Android build to Google Play

npm run setup:ads      # Sync package.json autolinking + app.json plugin based on AppConfig.ads.enabled
```

## Commit Messages

- Conventional Commits format `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`
- Scope optional, use package name when relevant (e.g., `expo-example`, `llama`)
- Lowercase, no period, imperative mood
- Example: `feat(expo-example): add maxSteps setting for tool iterations`

## Branch Naming

- Format: `type/kebab-case-description`
- Types: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `ci/`
- Example: `feat/tool-calling`, `fix/streaming-first-char-missing`

## Architecture

### Fonts

Font config is the single source of truth in `src/configs/fonts.ts`:

- `FONT_NAME` — PascalCase Google Font name (e.g. `'OpenSans'`)
- `fontFamilyMap` — maps semantic weights (`light` / `regular` / `medium` / `semibold` / `bold`) to font family strings
- `getFontFamilyForLanguage(language)` — returns `fontFamilyMap` for Latin-script locales, `undefined` for all others (triggers OS system font fallback)

**Font service** (`src/services/fonts/`):

- `useLoadFonts()` — loads fonts in dev (via `@expo-google-fonts/dev` over the network) and is a no-op in prod (fonts are natively embedded via the `expo-font` config plugin). Called in `RootLayout`; the splash screen is kept visible until fonts are loaded.

**Changing the font:**

1. Update `FONT_NAME` in `src/configs/fonts.ts`
2. Run `npx tsx scripts/setup-font.ts` — installs the `@expo-google-fonts/<font>` package and updates the `expo-font` plugin in `app.json`
3. Run `npx expo prebuild --clean` to embed fonts natively for production builds

**Typography tokens** — `t.typography.fontFamily` is typed as `ResolvedFontFamilyMap` (either `fontFamilyMap` or `Record<FontWeight, undefined>`). Always set both `fontFamily` and `fontWeight` together in styles — never set `fontWeight` alone, as React Native requires the per-weight font file to be specified explicitly.

### RTL Support

RTL layout is activated declaratively via `"supportsRTL": true` in the `expo-localization` plugin entry in `app.json`. When the device language is Arabic (`ar`) or Hebrew (`he`), the OS sets `I18nManager.isRTL = true` at app startup and React Native automatically mirrors flex rows, text alignment, and navigation. No JS call or app restart is needed.

**RTL service** (`src/services/rtl/`):

- `rtlService.ts` — `isRTLLanguage(lang)` boolean helper. `RTL_LANGUAGES = { 'ar', 'he' }`.
- `useIsRTL.ts` — `useIsRTL(): boolean` hook returning `I18nManager.isRTL`. Use in components with direction-sensitive custom rendering (e.g. Skia animations, hardcoded `left`/`right` absolute positions).
- `useRTLSync.ts` — `useRTLSync(): void` hook called once in `RootLayout`. Android-only; no-op on iOS. Handles two scenarios: (1) cold start where `I18nManager.isRTL` was frozen from the system language but the per-app locale disagrees — calls `forceRTL` and reloads; (2) per-app language changed while backgrounded — detects the change on foreground resume, updates RTL direction if needed, and reloads.
- `index.ts` — barrel exports

**Adding a new RTL language:** add its BCP-47 base code to `RTL_LANGUAGES` in `rtlService.ts`. No other changes needed — `supportsRTL: true` already covers layout mirroring.

**`PromoBanner`** uses `useIsRTL()` to flip its Skia shimmer sweep direction (RTL: right-to-left instead of left-to-right).

### Theming

- Provider: `src/theme/theme.tsx`.
- Tokens live in `src/theme/tokens/`
- `iconSizes` is a **static token** (not on `ResolvedTheme`) — import directly: `import { iconSizes } from '@/theme'`. Sizes: `xs` (12), `sm` (16), `md` (20), `lg` (24), `xl` (40), `hero` (80). Always use `iconSizes.*` instead of hardcoded numbers when passing a `size` prop to an icon component.

### Components

- Base components: `src/components/base/`.
- App specific components: `src/components/`.
- `Button` (`src/components/base/Button/`) — themed button with multiple variants (`primary`, `secondary`, `ghost`, `danger`, `inverted`, `outlined`), sizes (`sm`, `md`, `lg`), and optional left/right icon slots. Props: `label`, `variant`, `size`, `leftIcon`, `rightIcon`, `loading`, `fullWidth`, `disabled`, `children`, `animationType`, `loadingAnimation`. Press animations live in `pressAnimations/` (`useButtonAnimation.ts`, `useScaleAnimation.ts`, `useDarkenAnimation.ts`); `animationType` accepts `'scale' | 'darken' | 'none'` (default `'none'`). Loader components live in `src/components/base/Loader/` (see `Loader` entry below); `loadingAnimation` accepts `'spin-arc' | 'bouncing-dots' | 'pulsing-ring'` (default `'spin-arc'`). To add a new loading animation: create a component in `src/components/base/Loader/`, add the type key to `LoadingAnimationType` in `Button/types.ts`, and add one entry to the `loaders` map in `Button/index.tsx`.
- `Loader` (`src/components/base/Loader/`) — standalone animated loading indicators. Three components: `SpinArcLoader` (spinning arc), `BouncingDotsLoader` (three bouncing dots), `PulsingRingLoader` (pulsing concentric rings). All accept `color: string`; `SpinArcLoader` additionally accepts `size?: number` (default 20, stroke thickness scales proportionally). Import from `@/components/base/Loader`. `LoaderProps` is also exported from the same path.
- `CollapsingHeader` (`src/components/base/CollapsingHeader/`) — animated compact header bar that fades in and slides down as the user scrolls. Background animates from transparent to `colors.background.base` via `interpolateColor`. Hides the Expo Router native header (`headerShown: false`). Props: `title` (string), `scrollOffset` (`SharedValue<number>` from `useCollapsingHeader`), `right?` (ReactNode — optional button shown in the compact bar), `threshold?` (px scroll distance to complete the transition, default 60). Co-located exports: `useCollapsingHeader(options?)` returns `{ scrollOffset, largeTitleAnimatedStyle, onScrollOffsetChange, scrollHandler, headerHeight }` — `headerHeight` (`insets.top + 44`) is used as `paddingTop` on the scroll content container so content starts below the header. For `DraggableFlatList` use `onScrollOffsetChange`; for `Animated.ScrollView` use `scrollHandler` + `scrollEventThrottle={16}`. Options: `threshold?` (default 60), `headerInset?: boolean` — pass `headerInset: true` when the scroll view uses `contentInset.top = headerHeight` on iOS (e.g. `DraggableFlatList`) so the hook normalises the scroll offset automatically.
- `FadeScrollView` (`src/components/base/FadeScrollView.tsx`) — `ScrollView` wrapper that overlays a gradient fade at the bottom when content overflows. Accepts all `ScrollViewProps` plus `fadeHeight` and `bottomThreshold`. Uses `expo-linear-gradient`.
- `BottomSheet` (`src/components/base/BottomSheet.tsx`) — modal bottom sheet with spring animation, backdrop, and pan-to-dismiss gesture.
- `ListItem` (`src/components/base/ListItem/`) — flexible row layout component with left/right content slots and optional divider. Wraps in `Pressable` when `onPress` is provided. Props: `left` (ReactNode), `right` (ReactNode), `children` (fallback), `withDivider` (boolean), `onPress`, `haptic` (boolean, default true), `style`. Base component for specialized variants.
  - **`ActionListItem`** — variant with icon, title, subtitle, and trailing caret icon (for navigation/actions). Props: `icon` (Icon), `title` (string), `subtitle?` (string), `trailingIcon?` (Icon, default `CaretRightIcon`), and all base `ListItemProps`.
  - **`ToggleListItem`** — variant with icon, title, subtitle, and a toggle switch. Props: `icon`, `title`, `subtitle?`, plus `value`, `onValueChange`, `disabled`, `haptic` (boolean, default true).
  - **`SelectListItem`** — variant that opens a `BottomSheet` to pick from options. Generic over `T extends string | number | boolean`; accepts `value`, `options`, `onChange`, `sheetTitle`, and optional `renderLabel`.
  - **`ListItemInfo`** — extracted component for icon + title + subtitle display (reusable in custom variants). Props: `icon` (Icon), `title` (string), `subtitle?` (string). Sizes icon with `iconSizes.md`.
- `Toggle` (`src/components/base/Toggle.tsx`) — animated iOS-style switch using Reanimated. Props: `value`, `onValueChange`, `disabled`, `haptic` (default `true`), `style`.
- `SegmentedControl` (`src/components/base/SegmentedControl.tsx`) — multi-segment selector with spring-animated sliding indicator. Generic over option value type `T extends string`. `SegmentedOption` supports `icon?: (color: string) => ReactNode`, `iconPosition?: 'left' | 'right'`, and `locked?: boolean` (renders at reduced opacity when unselected).
- `TabBar` (`src/components/base/TabBar.tsx`) — custom bottom tab bar. Props: all `BottomTabBarProps` plus `showLabel?` (show route name below icon), `animationType?: 'indicator' | 'none'` (spring-animated dot above active tab), `blur?` (frosted-glass `BlurView` background; use for floating overlay layout), `blurIntensity?` (default 60). Pass `blur` when the tab bar floats over screen content.
- `PromoBanner` (`src/components/base/PromoBanner.tsx`) — premium upgrade banner. Props: `icon: ReactNode`, `title: string`, `subtitle: string`, `style?`. Navigates to `/paywall` on press. Renders a Skia `Canvas` overlay for two animation layers: a 3-stripe diagonal shimmer sweep (looping, ~2.8 s) and a horizontal ripple from the tap point. Requires `@shopify/react-native-skia` (already installed — run `expo prebuild --clean` after a fresh clone).
- `SearchInput` (`src/components/base/SearchInput.tsx`) — styled `TextInput` for search. Accepts all `TextInputProps` plus `containerStyle`.
- `Snackbar` (`src/components/base/Snackbar.tsx`) — presentational animated notification bar. Variants: `default | success | error | warning | neutral`. Layout: icon + title + optional subtitle. Supports optional `action` button and `bottomOffset`. Visual effect props: `showAccent` (default `false`) toggles the left/right border accent bars, `showShadow` (default `true`) toggles the drop shadow, `blur` (default `true`) enables a frosted-glass `BlurView` background (iOS only; no effect on Android) (`blurIntensity` default `60`). Animation is externally controlled via a `progress: SharedValue<number>` owned by `SnackbarHost`.
- `SnackbarHost` (`src/components/SnackbarHost.tsx`) — renders the current snackbar from the `snackbar` Zustand slice; handles auto-dismiss timing. Mounted once in `RootLayoutContent` (`_layout.tsx`).

### Onboarding Flow

The onboarding system is split into a **reusable core** and **app-specific content**.

**Reusable core** (`src/components/base/Onboarding/`): `OnboardingFlow`, `OnboardingPage`, `PaginationDots`, `OnboardingControls`, `types.ts`. These are template-ready — keep them intact when reusing in other projects. `OnboardingFlow` accepts:

```tsx
<OnboardingFlow
  pages={pages} // OnboardingPageItem[] — defined per-app
  swipeEnabled // boolean (default true)
  animationType="slide" // 'slide' (default) | 'fade'
  onComplete={fn}
  onSkip={fn} // optional, falls back to onComplete
/>
```

Animation modes: `'slide'` (default) provides live drag feedback — pages translate horizontally via a pixel-based `scrollPosition: SharedValue<number>` (value = `pageIndex * screenWidth` at rest) with spring snap-back on release. `'fade'` uses `withTiming` cross-fade driven by `currentIndex: SharedValue<number>` with no drag feedback. The gesture uses `.activeOffsetX([-10, 10])` and `.failOffsetY([-20, 20])` for reliable horizontal-only recognition, and velocity-based snapping (`|velocityX| > 500`) for natural flick gestures.

**App-specific content** (`src/components/onboarding/`): `onboardingPages.tsx` defines the `OnboardingPageItem[]` array (key + ReactNode); `OnboardingScreenContent.tsx` is the shared icon+title+description layout. To adapt for a new project, replace only these files and the `onboarding.*` translation keys.

**State** (`src/stores/features/onboarding.ts`): auto-discovered Zustand slice with `hasCompletedOnboarding` (persisted), `completeOnboarding()`, and `resetOnboarding()` (dev/debug use).

**Gating**: `src/app/_layout.tsx` uses `Stack.Protected guard={hasCompletedOnboarding}` to gate the `(tabs)`, `paywall`, and `debug` routes. A second `Stack.Protected guard={!hasCompletedOnboarding}` exposes only the `onboarding` screen until onboarding completes. MMKV is synchronous so there is no hydration flash. The `onboarding` Stack.Screen uses `animation: 'fade'` to avoid slide-back to onboarding after completion.

### Paywall

Shown after onboarding (skipped if `isSubscribed` is already true). Split into a **reusable core** and **app-specific usage** — the same pattern as onboarding.

**Reusable core** (`src/components/base/Paywall/`): `PaywallScreen`, `PackageOption`, `PaywallFeatureRow`, `PaywallHero`, `usePaywall`, `savings.ts`, `types.ts`. Keep these intact when reusing in other projects. `PaywallScreen` accepts:

```tsx
<PaywallScreen
  title={string}
  subtitle={string}
  features={PaywallFeatureItem[]}   // { icon, title, description? }
  onComplete={fn}                   // called after subscribe/dismiss
  onDismiss={fn}                    // close button handler
  onSubscribeSuccess?={fn}
  onSubscribeError?={fn}
  onRestoreSuccess?={fn}
  onRestoreNoSubscription?={fn}
  onRestoreError?={fn}
/>
```

`usePaywall` loads RevenueCat offerings, auto-selects the first package, and exposes `handleSubscribe` / `handleRestore`. User cancellation is handled silently (no error thrown).

**App-specific usage** (`src/app/onboarding.tsx`): defines the `PaywallFeatureItem[]` array and wires the callbacks (snackbar feedback, haptics).

**Paywall screen** (`src/app/paywall.tsx`): a separate `fullScreenModal` screen that shows `PaywallScreen` mid-app (e.g. triggered after trial expiry or via `PromoBanner`). Presented via `router.push('/paywall')` from anywhere inside the protected stack. Navigates back on complete/dismiss.

**Paywall slice** (`src/stores/features/paywall.ts`): auto-discovered Zustand slice that tracks timing for the auto-paywall feature.

| Field                      | Purpose                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `autoPaywallEnabledAt`     | Timestamp (ms) when the auto-paywall window was first opened (`null` until initialised)     |
| `autoPaywallLastShownAt`   | Timestamp (ms) of the last time the auto-paywall was shown                                  |
| `initAutoPaywallEnabled()` | Sets `autoPaywallEnabledAt` to `Date.now()` once (no-op on subsequent calls)                |
| `recordAutoPaywallShown()` | Updates `autoPaywallLastShownAt` to `Date.now()`                                            |
| `isAutoPaywallShowing`     | `true` while the auto-paywall screen is visible (not persisted); read by interstitial guard |
| `setAutoPaywallShowing()`  | Set by `useAutoPaywall` on open/close                                                       |

**RevenueCat service** (`src/services/revenueCat/`):

- `revenueCatService.ts` — thin wrapper around `react-native-purchases`: `initRevenueCat`, `fetchOfferings`, `purchasePackage`, `restorePurchases`, `checkEntitlement`, `getActiveEntitlementId`, `addCustomerInfoListener`, `getCustomerInfo`
- `useRevenueCatInit.ts` — hook replacement for the former `RevenueCatProvider`. Reads `userId` from the `userIdentity` slice internally; no-op while null. Once userId is ready: calls `initRevenueCat(userId)`, refreshes subscription status, attaches customer info listener and AppState listener. Call once in `RootLayout`.
- `index.ts` — barrel exports

`useRevenueCatInit()` is called in `RootLayout` in `src/app/_layout.tsx`. It reads `userId` from the `userIdentity` slice and is a no-op until it is non-null (i.e., after `useUserIdentityInit` resolves).

**Subscription slice** (`src/stores/features/subscription.ts`): auto-discovered Zustand slice. Tracks `isSubscribed` and `activeEntitlementId`. **All fields are excluded from MMKV persistence** — status is always refreshed from RevenueCat at runtime.

**AppConfig** (`src/configs/index.ts`) now includes `revenueCat` (API keys + entitlement ID), root-level `iosAppStoreId`, `support.email` (used by the Contact Support mailto flow in Settings), and `links` (terms of service + privacy policy URLs). Update these when deploying to production.

### Snackbar System

A lightweight in-app notification system composed of three layers:

- **`Snackbar`** (`src/components/base/Snackbar.tsx`) — presentational component; renders the animated bar. Animation driven by a `progress: SharedValue<number>` passed in from `SnackbarHost`.
- **`SnackbarHost`** (`src/components/SnackbarHost.tsx`) — owns animation (appear/dismiss), holds the `progress` shared value, and drives `<Snackbar>`. Uses a derived-state pattern (`useState` updated during render) to keep content visible through the exit animation. Mounted once in `RootLayoutContent`.
- **`snackbar` slice** (`src/stores/features/snackbar.ts`) — auto-discovered slice. API:

```ts
import { useSnackbarState } from '@/stores/features/snackbar'

const { showSnackbar, hideSnackbar } = useSnackbarState()

showSnackbar({
  title: 'Saved!',
  subtitle: 'Changes will sync shortly', // optional
  icon: CheckCircleIcon, // optional: Icon | null (null forces no icon)
  variant: 'success', // 'default' | 'success' | 'error' | 'warning' | 'neutral'
  durationMs: 4000, // optional, default 4000; set ≤ 0 to persist until dismissed
  action: { label: 'Undo', onPress: fn }, // optional
  bottomOffset: 0, // optional numeric override
})
```

The `snackbar` state field is excluded from MMKV persistence.

### App Review

- Service layer: `src/services/storeReview/`
- `useAppReview()` keeps the automatic in-app prompt flow via `expo-store-review.requestReview()` after conversion actions.
- `openWriteReview()` provides a manual Settings entry point that opens the App Store write-review URL on iOS (`?action=write-review`) using `AppConfig.iosAppStoreId`.
- On Android, `openWriteReview()` derives package name from Expo config (`Constants.expoConfig?.android?.package`) and opens the Play Store listing URL.
- `openWriteReview()` failures should be recorded with Sentry (`recordError`) and should not show snackbar fallback.
- Settings `Rate App` row (`src/app/(tabs)/settings.tsx`) must call `openWriteReview()`.
- Configure `AppConfig.iosAppStoreId` as soon as the production App Store app ID is known.

### Settings Screen (`src/app/(tabs)/settings.tsx`)

The Support section contains three rows in this order:

1. **Contact Support** — opens a pre-filled `mailto:` link using `AppConfig.support.email`, device info (OS, version, model), and `userId`. Falls back to a snackbar error if no email client is available.
2. **Rate App** — calls `openWriteReview()` from `@/services/storeReview`.
3. **Share App** — invokes the native `Share` sheet. On iOS, shares a message + App Store URL (from `AppConfig.iosAppStoreId`); on Android, appends the Play Store URL (derived from `Constants.expoConfig?.android?.package`) to the message. User cancellation is handled silently.

### State Management (Zustand)

State lives in `src/stores/` and is split into slice files under `src/stores/features/`. Adding a new slice requires creating **one file only** — no barrel updates, no explicit imports elsewhere.

**How auto-discovery works:**

- `src/stores/slices/index.ts` uses `require.context('../features', false, /\.ts$/)` to auto-register all slice files via their exported `sliceConfig`.
- Each slice file extends the global `AppSlices` interface via `declare global { interface AppSlices { xxx: XxxSlice } }`. Because `tsconfig.json` includes `**/*.ts`, TypeScript picks up all augmentations project-wide — no explicit import needed.
- `src/stores/appStore.ts` uses the global `AppSlices` directly.

**Slice file convention** (`src/stores/features/xxx.ts`):

```ts
import { useShallow } from 'zustand/react/shallow'
import type { ExcludeKeys, SliceConfig } from '../slices/types'
import { getUseAppStore } from '../slices/types'

declare global {
  interface AppSlices {
    xxx: XxxSlice
  }
}

export interface XxxSlice { ... }

export const xxxPersistExcludeKeys: ExcludeKeys<XxxSlice> = []
// ⚠️ Do NOT add function/action keys to persistExcludeKeys — functions are already
// automatically excluded by selectPersistedState (via `typeof v !== 'function'` check).
// Only list non-function state keys that should be excluded from persistence.

export const createXxxSlice = (set, get): XxxSlice => ({ ... })

export const sliceConfig = {
  create: createXxxSlice,
  persistExcludeKeys: xxxPersistExcludeKeys,
  // Optional — only needed if this slice has ever shipped persisted state that requires migration
  version: 1,
  migrations: {
    1: (state) => ({ newField: 'default' }),  // state is Partial<XxxSlice>, return Partial<XxxSlice>
  },
} satisfies SliceConfig<XxxSlice>

export const useXxxState = () =>
    getUseAppStore()(useShallow(({ xxx }) => ({
    someField: xxx.someField,
    someAction: xxx.someAction,
  })))
```

**Per-feature migrations:**

Each slice independently tracks its own version via a `_sliceVersions` record stored inside the persisted state blob. On rehydration, `buildMigrate` (in `slices/migrate.ts`) runs only the migrations needed to bring each feature up to its declared `version`. The global Zustand `version` (always `1`) is only a sentinel to trigger `migrate` on first launch — all real versioning happens per feature.

- Only add `version`/`migrations` to a slice when you need to migrate existing persisted data. Omit them for new slices with no migration history.
- Migration functions receive and return `Partial<XxxSlice>` — scoped to the slice only, no need to spread the full state.

**Key files:**

- `src/stores/global.d.ts` — seeds the global `interface AppSlices {}`
- `src/stores/slices/types.ts` — `SliceConfig<T>`, `ExcludeKeys<T>`, `AppPersistedState`, `getUseAppStore` (lazy accessor to avoid circular deps)
- `src/stores/slices/migrate.ts` — `buildMigrate`, `SLICE_VERSIONS_KEY`, `FeatureMigrationConfig`
- `src/stores/slices/index.ts` — `require.context` auto-registration, assembles migrations, and `selectPersistedState`
- `src/stores/slices/persist.ts` — type utilities (`NonFunctionKeys<T>`, `PersistedState<T>`)
- `src/stores/appStore.ts` — creates the Zustand store
- `src/stores/index.ts` — re-exports from `./appStore`

**Consumer imports** — import hooks directly from the feature file, not from `@/stores`:

```ts
import { useConverterState } from '@/stores/features/converter'
import { useThemeState } from '@/stores/features/theme'
import { usePreferencesState } from '@/stores/features/preferences'
```

**`SliceConfig<T>` note:** uses `create: (...args: any[]) => T` (untyped set/get) because `XxxSlice` alone is not assignable to the fully-augmented `AppSlices`, which would cause `satisfies` to fail with strict set/get types. The return type `T` is still enforced.

### Storage

- MMKV storage is split by domain under `src/storage/`
- Keys follow the `namespace.name` pattern (e.g. `zustand.state`, `query.state`). Use `buildStoreKey` / `buildQueryKey` from their respective storage modules to derive keys — never hardcode the full MMKV key string.
- `src/utils/debugState.ts` provides helpers for reading live and persisted state, diffing them, and clearing storage — used by the debug screen (`src/app/debug.tsx`).

### Utils

- Utility funtions should be put under `src/utils/` with each util function placed in a separate file.
- More than one util can be placed in the same file they are relevant.
- `withAlpha(hex, alpha)` (`src/utils/color.ts`) — converts a hex color string to `rgba(r,g,b,alpha)`. Use instead of hardcoding `rgba(...)` literals when applying opacity to theme colors (e.g. `withAlpha(t.colors.background.base, 0.12)`).
- `withTimeout(promise, ms, message)` (`src/utils/withTimeout.ts`) — races a promise against a timer; rejects with `Error(message)` if the promise does not settle within `ms` milliseconds. Use when wrapping network calls that have no intrinsic deadline (e.g. `expo-updates` APIs) to prevent a hung request from permanently blocking a stateful guard. Note: the underlying promise is not cancelled — its eventual settlement is silently ignored.
- `getCurrencyLocalizedName(code, locale, fallback)` (`src/utils/currency.ts`) — looks up a currency's display name from the i18n resource bundle (pre-generated `currencies.*` keys); falls back to English, then to `fallback`. Use instead of accessing `currency.name` directly wherever currency names are rendered.
- `useCurrencies()` (`src/utils/currency.ts`) — returns `LocalizedCurrency[]` (all `Currency` entries extended with `localizedName`), sorted alphabetically by the current locale. Use this whenever a list of all currencies is needed in a component.
- `useSuggestedCurrency()` (`src/utils/currency.ts`) — returns the suggested `LocalizedCurrency` (or `null`) based on device region. Previously lived in `src/utils/useSuggestedCurrency.ts` (deleted).
- `CURRENCY_CODES` (`src/constants/currencyCodes.ts`) — shared array of all supported ISO 4217 currency codes. Used by `generate-currency-names.ts` and `currencies.ts`.

### Layout Constants

- `TAB_BAR_HEIGHT` (`src/constants/layout.ts`) — fallback/initial value (80 pt) for the floating tab bar height. Do **not** use this directly in screens — use `useTabBarHeight()` instead.
- `useTabBarHeight()` / `useSetTabBarHeight()` (`src/components/base/FloatingTabBar/tabBarHeight.tsx`) — context-based hook that returns the **measured** height of the entire floating overlay (`BannerAd + TabBar`). Measured via `onLayout` in `FloatingTabBar` (`(tabs)/_layout.tsx`). Use `useTabBarHeight()` as `paddingBottom` in all tab screens and the `Snackbar` component so content clears the overlay automatically, even when an ad banner is present. The `TabBarHeightProvider` is mounted at the root in `_layout.tsx`.

### FloatingTabBar

A component that combines `BannerAd` + `TabBar` into an absolute-positioned overlay with dynamic height measurement.

**Component** (`src/components/base/FloatingTabBar/FloatingTabBar.tsx`):

- Wraps `<BannerAd />` + `<TabBar {...props} blur />` in absolute positioning (`bottom: 0, left: 0, right: 0`)
- Measures its own layout height and publishes it via `useSetTabBarHeight()` so descendant screens can reserve space
- Always pass the full `BottomTabBarProps` to `FloatingTabBar` — it proxies them to `TabBar`

**Provider** (`src/components/base/FloatingTabBar/tabBarHeight.tsx`):

- `TabBarHeightProvider` — wraps the root layout in `src/app/_layout.tsx`. Provides measured height to all descendants.
- `useTabBarHeight()` — returns the measured height; use as `paddingBottom` in tab screens + `Snackbar`
- `useSetTabBarHeight(height)` — called internally by `FloatingTabBar` on layout change

**Integration** (`src/app/(tabs)/_layout.tsx`):

```tsx
<Tabs tabBar={(props) => <FloatingTabBar {...props} />} ... />
```

### Firebase Analytics

- SDK: `@react-native-firebase/*` (native SDK only). The former `firebase@12` web SDK was removed — it was unused.
- Cloud Functions are called via plain `fetch()` in the domain query files (`src/services/queries/rates.ts`, `src/services/queries/timeSeries.ts`) using `AppConfig.firebase.projectId`. No Firebase SDK needed there.
- Service layer: `src/services/firebase/` — follows the same pattern as `revenueCat/`

**Key files:**

- `analytics/analyticsService.ts` — `trackEvent`, `trackScreenView`, `setAnalyticsUserId`, `setAnalyticsUserProperties`
- `analytics/analyticsGeneralEvents.ts` — **generic events** (onboarding, paywall, error boundary) — template-ready, do not add app-specific events here
- `analytics/analyticsAppEvents.ts` — **app-specific events** — replace this file entirely when forking the template for a new project
- `analytics/types.ts` — `AnalyticsEventName` union type (imported by `analyticsService.ts` to avoid circular deps)
- `analytics/useScreenTracker.ts` — auto screen tracking hook
- `analytics/index.ts` — barrel exports for analytics
- `index.ts` — root barrel; re-exports from analytics

**Tracking events** — import from the analytics subfolder:

```ts
import { trackEvent, AnalyticsAppEvents, AnalyticsGeneralEvents } from '@/services/firebase/analytics'
trackEvent(AnalyticsGeneralEvents.PAYWALL_VIEWED) // generic
trackEvent(AnalyticsAppEvents.CURRENCY_ADDED, { code: 'USD' }) // app-specific
```

**User properties** — `setAnalyticsUserProperties(properties: Record<string, string>)` sets Firebase Analytics user properties (string values only). Called at module level in `_layout.tsx` to set `app_version` on every cold start. Values persist across sessions until overwritten.

**Screen tracking** — automatic via `useScreenTracker()` hook called in `RootLayoutContent` (`_layout.tsx`). Zero per-screen code needed. Hook lives in `src/services/firebase/analytics/useScreenTracker.ts` and is exported from `@/services/firebase/analytics`.

**Native config files** (per-app, replace when forking template):

- iOS: `ios/<appname>/GoogleService-Info.plist`
- Android: `android/app/google-services.json`
- After replacing: run `expo prebuild --clean`

### User Identity

Service layer: `src/services/userIdentity/`.

Generates a stable anonymous UUID on first cold start and propagates it to Sentry, RevenueCat, and Firebase Analytics. No authentication — the ID is anonymous and device-bound.

**Storage:** `expo-secure-store` (`Keychain` on iOS → survives app uninstall; `EncryptedSharedPreferences` on Android → reset on reinstall, acceptable since purchase restoration works independently via store receipts).

**Variant isolation:** All build variants share the same bundle ID / package name, so SecureStore is keyed per variant to prevent dev / preview / production user IDs from colliding in analytics and RevenueCat. Key format: `user.identity.${APP_VARIANT}` (e.g. `user.identity.development`, `user.identity.preview`, `user.identity.production`). The variant is read from `process.env.APP_VARIANT` at bundle time. Sentry is already `enabled: !__DEV__`, so Sentry user IDs are a no-op in dev.

**Key files:**

- `userIdentityService.ts` — `getOrCreateUserId()`, `clearUserId()`
- `useUserIdentityInit.ts` — one-time init hook; reads/generates the ID, sets `userIdentity` slice + Sentry + Firebase. Call once in `RootLayout`.
- `index.ts` — barrel exports

**Zustand slice** (`src/stores/features/userIdentity.ts`): auto-discovered. Fields: `userId` (excluded from MMKV persistence), `setUserId`, `clearUserId`. Import hook:

```ts
import { useUserIdentityState } from '@/stores/features/userIdentity'
```

**Initialization flow** (`src/app/_layout.tsx`):

```ts
// In RootLayout:
useUserIdentityInit() // loads ID async → sets slice + Sentry + Firebase
useRevenueCatInit() // no-op until userId is ready
```

**RevenueCat:** `useRevenueCatInit()` reads `userId` from the `userIdentity` slice and uses it via `Purchases.configure({ apiKey, appUserID: userId })`. See `### Paywall` for the full RevenueCat service contract.

**Debug screen:** Displays the current `userId` and has a "Reset User ID" button that clears SecureStore + the slice. The next cold start generates a fresh ID.

### Sentry (Error Tracking)

- SDK: `@sentry/react-native`
- Handles both native crashes and JS errors with automatic source map symbolication
- Service layer: `src/services/sentry/` — follows the same pattern as `revenueCat/`

**Key files:**

- `src/services/sentry/sentryService.ts` — `initSentry`, `recordError`, `logBreadcrumb`, `setSentryUser`, `setSentryTag`
- `src/services/sentry/index.ts` — barrel exports
- `metro.config.js` — wraps default Expo config with `getSentryExpoConfig` for source map bundling

**Initialisation** — `initSentry()` is called at **module level** in `src/app/_layout.tsx` (before any component renders). It is a plain function, not a hook. Disabled in dev (`enabled: !__DEV__`).

**Error tracking** — import from `@/services/sentry`:

```ts
import { recordError, logBreadcrumb, setSentryUser, setSentryTag } from '@/services/sentry'
```

**ErrorBoundary** — `src/components/base/ErrorBoundary.tsx` — the **only class component** in the codebase (required by `getDerivedStateFromError`/`componentDidCatch`). Calls `recordError` from `@/services/sentry`. Do NOT refactor to a function component.

**DSN config** — stored in `AppConfig.sentry.dsn` (`src/configs/index.ts`). Replace the placeholder with the real DSN from Sentry dashboard → Projects → Settings → Client Keys.

**Source maps (EAS builds)** — the `@sentry/react-native/expo` plugin in `app.json` auto-uploads source maps during EAS builds when `SENTRY_AUTH_TOKEN` is set as an EAS secret:

```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
```

**Sentry in dev:** `enabled: !__DEV__` — errors are visible in Metro. For local Sentry testing use `npx @spotlightjs/spotlight`.

### Ads (AdMob)

Service layer: `src/services/ads/`. The library (`react-native-google-mobile-ads`) is always installed but excluded from native builds and JS bundle when ads are disabled.

**Two-layer exclusion when `AppConfig.ads.enabled = false`:**

1. **Native layer** — `package.json` `expo.autolinking.exclude` prevents the CocoaPod (iOS) and Gradle dep (Android) from being compiled. Managed by `npm run setup:ads`.
2. **JS layer** — `useAdsInit()` is not called in `_layout.tsx`. Metro never traverses into `src/services/ads/` from the root, so the library is not bundled.

**Key files:**

- `adsService.ts` — `isAdsEnabled()`, `initMobileAds()`, `getAdUnitId(type)`. Re-exports all types from `react-native-google-mobile-ads` so consumers never import the package directly. Returns `TestIds.*` in `__DEV__` or when disabled.
- `useAdsInit.ts` — one-time SDK init hook; waits for `consentGathered` before calling `mobileAds().initialize()`. Called in `RootLayout` when ads are enabled.
- `useConsentInit.ts` — runs ATT (iOS) then UMP consent flow; sets `consentGathered` in the ads slice. Consent errors are logged to Sentry but never block ad initialization (fail-open). Called in `TabLayout`.
- `BannerAd.tsx` — one-line `<BannerAd />` component. Returns `null` when disabled or `isSubscribed`.
- `useInterstitialAd.ts` — returns `{ show, isLoaded, isShowing, error }`. `show()` enforces grace period, cooldown, and paywall-overlap guards automatically. Auto-reloads by default.
- `useInterstitialAdInit.ts` — lifecycle hook. Call once in `TabLayout`. Increments the session counter on cold start and each foreground resume, and attempts to show an interstitial on every foreground resume.
- `index.ts` — barrel exports

**State** (`src/stores/features/ads.ts`): auto-discovered Zustand slice. SDK init state (`adsInitialized`, `adsInitError`, `consentGathered`, `privacyOptionsRequired`) is excluded from MMKV persistence and refreshed at runtime. Interstitial trigger state (`interstitialLastShownAt`, `interstitialSessionCount`) is persisted across sessions.

**`AppConfig.ads`** (`src/configs/index.ts`):

```ts
AppConfig.ads.enabled                          // toggle ads on/off
AppConfig.ads.ios.appId                        // AdMob iOS App ID
AppConfig.ads.ios.bannerAdUnitId               // per ad-type unit IDs
AppConfig.ads.ios.interstitialAdUnitId
AppConfig.ads.android.*                        // same shape for Android
AppConfig.ads.interstitial.gracePeriodSessions // sessions before first interstitial
AppConfig.ads.interstitial.cooldownMs          // min ms between interstitial shows
```

**`scripts/setup-ads.ts`** — reads `AppConfig.ads.enabled` and syncs:

- `package.json` → `expo.autolinking.ios/android.exclude` (add/remove `react-native-google-mobile-ads` and `expo-tracking-transparency`)
- `app.json` → `expo.plugins` array (add/update or remove both native plugin entries)

Run after any change to `AppConfig.ads.enabled`, then run `expo prebuild --clean`.

**Enabling ads (checklist):**

1. Set `AppConfig.ads.enabled = true` and fill in all App IDs and ad unit IDs
2. Run `npm run setup:ads` — removes both packages from autolinking exclude, adds both plugins to `app.json`
3. Add `useAdsInit()` call inside `RootLayout` in `src/app/_layout.tsx`
4. Add `useConsentInit()` call inside `TabLayout` in `src/app/(tabs)/_layout.tsx`
5. Add `useInterstitialAdInit()` call inside `TabLayout` in `src/app/(tabs)/_layout.tsx`
6. Run `npx expo prebuild --clean`

**Disabling ads (checklist):**

1. Set `AppConfig.ads.enabled = false`
2. Run `npm run setup:ads` — adds both packages to autolinking exclude, removes both plugins from `app.json`
3. Remove `useAdsInit()` call from `src/app/_layout.tsx`
4. Remove `useConsentInit()` call from `src/app/(tabs)/_layout.tsx`
5. Remove `useInterstitialAdInit()` call from `src/app/(tabs)/_layout.tsx`
6. Run `npx expo prebuild --clean`

**Ad placement API:**

```tsx
// Banner (one line, handles null/subscription guard internally)
import { BannerAd } from '@/services/ads'
<BannerAd />

// Interstitial
import { useInterstitialAd } from '@/services/ads'
const { show, isLoaded } = useInterstitialAd()
<Button onPress={show} />
```

**Important notes for agents:**

- Do NOT import directly from `react-native-google-mobile-ads` — always import via `@/services/ads` or from `adsService.ts`
- `BannerAdSize` is a TypeScript enum (not `BannerAdSizeType`)
- The `ads` Zustand slice auto-discovers like any other; no registration needed
- Subscription awareness is built-in: `<BannerAd />` and the ad hooks check `isSubscribed` internally

### Data Layer

- API entry point: `src/services/queries/` — each domain file owns its full stack
- Strategy: offline-first
  - hydrate from cache first
  - fetch latest from API
  - fall back to cache on request failure
  - expose data source (`'api' | 'cache'`)

**Domain file shape** (`rates.ts`, `timeSeries.ts`) — follow this layer order when adding new domains:

1. Private fetch function (not exported — only called from query options)
2. Query keys export
3. Query options export
4. Hook exports

**Template boundary:**

- `queries/provider/` — template infrastructure (TanStack Query provider + persistence). Keep intact when forking.
- `queries/*.ts` (except `index.ts`) — app-specific query files. Replace entirely when forking for a new project.
- `utils/network.ts` — template utility (`assertOnline`, `getEmulatorHost`). Keep intact when forking.

## Code Conventions

- Reuse aliases (`@/...`) instead of deep relative imports where practical.
- Prefer named export instead of default export.
- Do not use `import React from 'react'`. Only import what is needed: `import { useRef, useState } from 'react'`.
- Follow Prettier config defined in `.prettierrc` file.
- Prefer TypeScript (`.ts` / `.tsx`) for all new code.
- Prefer arrow function for React Component declaration.
- Always use translation text (i18n) instead of hard-coded user-facing strings. When adding new text, add/update the same translation key in all locale resource files (`en`, `vi`, `de`, `es`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `pt-BR`, `ru`, `th`, `tr`, `zh-Hans`, `zh-Hant`). Do **not** manually add `currencies.*` keys — these are auto-generated by `scripts/generate-currency-names.ts`.
  - **Exception:** `src/app/debug.tsx` is a dev-only screen (`__DEV__` guard). Do **not** use `useTranslation` or i18n keys there — hardcode all strings in English directly.
- TypeScript: Never use `any` type unless there is absolutely no other option (e.g. SliceConfig internals where strict generics break `satisfies`). Prefer `unknown`, explicit generics, or proper type narrowing instead.
- Animations: **Always** use `react-native-reanimated` **v4** — never use React Native's built-in `Animated` API.
  - Shared values: `useSharedValue` (replaces `useRef(new Animated.Value(...))`)
  - Animated styles: `useAnimatedStyle` (replaces `.interpolate()` on `Animated.Value`)
  - Spring animation: `withSpring` (replaces `Animated.spring`)
  - Timing animation: `withTiming` (replaces `Animated.timing`)
  - Color interpolation: `interpolateColor` (replaces color `.interpolate()` — this also avoids the native driver restriction on color animations)
  - Number interpolation: `interpolate` (replaces numeric `.interpolate()`)
  - Animated components: `Animated.View`, `Animated.Text` etc. from `react-native-reanimated` (not `react-native`)
  - If a component needs per-instance animation hooks (`useSharedValue`, `useAnimatedStyle`), extract it as its own component rather than calling hooks inside a render helper function or `.map()` callback.
- Theme: All components use `useThemedStyles(createStyles)` for theme-aware styling.
  - **Always** define `createStyles` using `createThemedStyles` (imported from `@/theme`), placed below the component declaration:
    ```ts
    const createStyles = createThemedStyles((t) => ({
      container: { backgroundColor: t.colors.background.card },
    }))
    ```
  - `createThemedStyles` automatically applies `StyleSheet.create` — do **not** call `StyleSheet.create` manually inside it.
  - For components with variant/size sub-groups, flatten all keys in `createStyles` (e.g. `variantDefault`, `paddingSm`) and resolve the active style via an explicit object lookup in the component body:
    ```ts
    const variantStyle = { default: styles.variantDefault, surface: styles.variantSurface }[variant]
    ```
  - Use `useTheme()` directly for non-style theme values (e.g. `colors.primary.main` passed to third-party icon props or `Animated.interpolate` color values). Do **not** put non-style values inside `createStyles`.
  - **Always** use theme tokens (`t.colors.*`, `t.spacing.*`, `t.typography.*`, `t.borderRadius.*`, etc.) for all style values — never hardcode raw colors, spacing, font sizes, border radius, or other design values. Raw literals like `'#fff'`, `16`, `'bold'` are only acceptable for structural layout values that have no token equivalent (e.g. `flex: 1`, `position: 'absolute'`).
- Icons: use `phosphor-react-native` for all icons. Always size icons with `iconSizes.*` from `@/theme` — never pass raw numbers. Default weight is `regular`. Tab bar icons use `weight={focused ? 'fill' : 'regular'}` via the `focused` param from Expo Router's `tabBarIcon` callback. When a prop accepts an icon component, use `import type { Icon } from 'phosphor-react-native'` as the type. Import icons using the `Icon`-suffixed names (e.g. `LockIcon`, `StarIcon`). Example: `<LockIcon size={iconSizes.sm} color={theme.colors.text.muted} weight="regular" />`.
- Color opacity: use `withAlpha(hexColor, alpha)` from `@/utils/color` instead of inline `rgba(...)` literals.

## Store Metadata (Fastlane)

Store listing metadata (name, subtitle, description, keywords, release notes, categories, support URLs) and screenshots for both App Store Connect and Google Play are managed via **Fastlane**, configured at the **repo root** (not under `ios/` / `android/`) so the setup survives `expo prebuild --clean`.

### Layout

```
fastlane/
  Appfile           # bundle id + package name (reads creds from ENV)
  Fastfile          # two lanes: `ios metadata`, `android metadata`
  Pluginfile        # optional
  .private/         # gitignored — ASC API key + Play service account JSON
  ios/
    metadata/<asc-locale>/...
    metadata/review_information/  # gitignored — reviewer contact info
    screenshots/<asc-locale>/<device>/<image>.png
  android/
    metadata/<play-locale>/
      title.txt, short_description.txt, full_description.txt
      changelogs/default.txt
      images/{icon,featureGraphic,phoneScreenshots,tenInchScreenshots}/
.env.fastlane.example    # template (committed)
.env.fastlane.local      # real credentials (gitignored, auto-loaded by Fastfile)
```

Both `deliver` and `supply` are configured via `metadata_path` / `screenshots_path` in the Fastfile, so the file layout above is not fastlane's default — it's an explicit override.

### Shared values (don't duplicate per-locale)

- **iOS support / marketing / privacy URLs** — set inline in `Fastfile`'s `SHARED_IOS_URLS` constant. `deliver` writes the same value to every locale automatically. **Do not** create per-locale `support_url.txt` / `marketing_url.txt` / `privacy_url.txt` files.
- **iOS globals** (`copyright`, categories) — single files at the metadata root, not per-locale. `review_information/` is gitignored — create it locally (see **Credentials** below).
- **Screenshots** — only commit screenshots for locales you actually localize (e.g. `en-US`, `vi`). Both App Store Connect and Play Console fall back to the default locale's screenshots automatically for all other locales. Update `en-US/` once and every non-localized locale page reflects it.

### Credentials

- **iOS API key** — App Store Connect API key (`.p8` file). Configure via `APP_STORE_CONNECT_API_KEY_KEY_ID`, `APP_STORE_CONNECT_API_KEY_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_KEY_FILEPATH` in `.env.fastlane.local`.
- **iOS review contact** — `fastlane/ios/metadata/review_information/` is gitignored (contains PII). Create it locally before running the iOS lane:
  ```bash
  mkdir -p fastlane/ios/metadata/review_information
  echo "Your Name"      > fastlane/ios/metadata/review_information/first_name.txt
  echo "Your Surname"   > fastlane/ios/metadata/review_information/last_name.txt
  echo "you@example.com" > fastlane/ios/metadata/review_information/email_address.txt
  echo "+1234567890"    > fastlane/ios/metadata/review_information/phone_number.txt
  touch fastlane/ios/metadata/review_information/demo_user.txt
  touch fastlane/ios/metadata/review_information/demo_password.txt
  touch fastlane/ios/metadata/review_information/notes.txt
  ```
- **Android** — Google Play service account JSON. Configure via `GOOGLE_PLAY_JSON_KEY_PATH` in `.env.fastlane.local`.

The Fastfile auto-loads `.env.fastlane.local` at startup.

### npm scripts

```bash
npm run fastlane:ios:init                # one-shot: pull live ASC listing into fastlane/ios/metadata
npm run fastlane:android:init            # one-shot: pull live Play listing into fastlane/android/metadata
npm run fastlane:ios:metadata            # push ALL locales to App Store Connect
npm run fastlane:ios:metadata:globals    # push ONLY non-localized globals (categories, copyright, review_information, app_rating_config); skips all locale folders + screenshots — much faster
npm run fastlane:ios:metadata:test       # push only en-US + vi (for verification before full rollout)
npm run fastlane:android:metadata        # push ALL locales to Google Play
npm run fastlane:android:metadata:test   # push only en-US + vi
npm run fastlane:android:metadata:validate  # Google Play dry-run (no changes committed)
```

Both `:metadata` lanes use `skip_binary_upload: true` — they do **not** upload a build, only listing content. Safe to run against a published version.

### Restricting upload to specific locales

Both lanes accept a `locales:"<csv>"` CLI parameter:

```bash
fastlane ios metadata locales:"en-US,vi,ja-JP"
fastlane android metadata locales:"en-US,vi"
```

- **iOS** uses `deliver`'s native `languages:` filter — only the listed locales get touched in App Store Connect.
- **Android** has no native filter, so the lane mirrors only the selected locale folders into `fastlane/.tmp/android-metadata/` (gitignored) and points `supply` at that subset. The lane errors out clearly if you name a locale folder that doesn't exist.

### Locale mapping

The project ships 33 locales; not all map 1:1 to store-supported codes. Notable cases:

- `en` → `en-US` (both stores)
- `pt` → `pt-PT`, `pt-BR` stays `pt-BR`
- `zh-Hans` → `zh-Hans` (ASC) / `zh-CN` (Play)
- `zh-Hant` → `zh-Hant` (ASC) / `zh-TW` (Play)
- `no` → `nb-NO` on Play
- `he` → `iw-IL` on Play
- `bn` → `bn-BD` on both stores (Apple added Bengali in March 2026 — requires fastlane ≥ 2.234)

Only create folders for locales the target store supports. Folder names use the store's locale code, not the project's. The authoritative list of ASC-accepted codes lives in your installed fastlane gem at `deliver/lib/deliver/languages.rb` (`Deliver::Languages::ALL_LANGUAGES`).

## Expo Documentation

Always fetch the appropriate Expo docs file before working on Expo-related tasks. Use `WebFetch` with the URL and a targeted prompt describing what you need.

| Situation                                                                                        | URL to fetch                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------- |
| Finding which doc page covers a topic                                                            | `https://docs.expo.dev/llms.txt`      |
| SDK APIs, components, hooks, config plugins, or `expo-*` packages                                | `https://docs.expo.dev/llms-sdk.txt`  |
| EAS Build, EAS Submit, EAS Update, EAS secrets, workflows                                        | `https://docs.expo.dev/llms-eas.txt`  |
| Expo Router, Expo Modules API, general development workflow, or anything spanning multiple areas | `https://docs.expo.dev/llms-full.txt` |

> This project uses **Expo SDK 55**. The `/llms-sdk.txt` file covers the latest SDK — use it for SDK 55 APIs. Legacy SDK bundles (e.g. `/llms-sdk-v54.0.0.txt`) exist but are not needed here.

For a single targeted doc page, append `/index.md` to the page URL (e.g. `https://docs.expo.dev/router/introduction/index.md`) to get a lightweight markdown version.

## Agent Working Rules

- **Never modify files in `android/` or `ios/` directly** — these are generated by `expo prebuild` and will be overwritten. To change native configuration, update `app.json` / `app.config.ts`, use config plugins, or add an Expo plugin. Always fetch Expo docs (see **Expo Documentation** section above) first to find the proper approach before attempting native changes.
- Prefer small, focused changes over broad refactors.
- Keep existing architecture and ask if need to change architecture.
- Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
- Keep components small and focused; extract reusable UI when duplication appears.
- Do not commit secrets, tokens, or environment-specific credentials.
- Before handing off, verify `npm run check` passes.
- After any change that affects app structure, conventions, or architectural patterns, update `AGENTS.md` and `README.md` to reflect the new state. This includes: new utilities or type helpers, changes to slice/store conventions, new patterns for components or storage, and any other structural change a future agent would need to know about.
