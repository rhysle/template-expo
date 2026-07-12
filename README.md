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

## Start a New App

1. Install dependencies with `npm install`.
2. Update the identity, package identifiers, icons, splash assets, and build configuration in `app.json`, `eas.json`, and `assets/images/`.
3. Replace placeholder values in `src/configs/AppConfig.ts`, including support contact details, legal links, store ID, RevenueCat keys, Sentry DSN, and ad unit IDs.
4. Replace the product-specific examples: `src/app/(tabs)/index.tsx`, tab metadata in `src/app/(tabs)/_layout.tsx`, settings preferences, `src/components/onboarding/`, and `src/components/paywall/usePaywallFeatures.ts`.
5. Update `src/services/firebase/analytics/analyticsAppEvents.ts` with product events, then add any product API/query modules under `src/services/queries/`.
6. Review every locale file in `src/i18n/locales/`; the template ships with translated sample copy that should be adapted to the new product.
7. Run `npm run check` before starting app work.

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

## Optional Product Services

These integrations are available but should be configured deliberately for each product:

- **RevenueCat:** reusable paywall UI lives in `src/components/base/Paywall/`; replace the feature list and configure entitlement/API keys before enabling paid access.
- **AdMob:** controlled by `AppConfig.ads.enabled`. When changing it, run `npm run setup:ads`, add or remove the related layout hooks as instructed in the service comments, then run a clean prebuild.
- **Firebase Analytics:** keep generic lifecycle events in `analyticsGeneralEvents.ts`; define product events in `analyticsAppEvents.ts`.
- **Sentry:** configure the product DSN and EAS source-map secret before release.
- **OTA updates:** controlled by `AppConfig.otaUpdate.enabled` and initialized in the root layout.
- **Store review, support, sharing:** settings helpers read `AppConfig`; replace the provided contact and legal values before release.

## Build and Release

EAS profiles are defined in `eas.json`. Common production commands are `npm run eas-build`, `npm run eas-build:ios:submit`, `npm run eas-build:android:submit`, and `npm run eas-update`.

Fastlane at the repository root manages App Store Connect and Google Play listing metadata and screenshots. Update its package identifiers, shared URLs, locale folders, and credentials for each new app before running the `fastlane:*` scripts. Keep secrets and reviewer contact information out of Git.

## Verification

At a minimum, run `npm run check` after code or translation changes. For native dependency or configuration changes, also run `npm run prebuild:clean` and test the affected platform.
