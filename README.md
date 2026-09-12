# Rhysle mobile apps

A pnpm workspace containing independently released Expo iOS/Android apps and one maintained mobile core. Apps live in workspace directories; feature branches represent changes rather than permanent app variants.

## Workspace

| Location               | Owns                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/starter`         | Clean reference app and source for the app generator                                               |
| `apps/speaker-cleaner` | Speaker Cleaner product, assets, translations, configuration, and store metadata                   |
| `packages/core`        | Reusable UI, themes, state/storage/query infrastructure, and native service integrations           |
| `packages/ads`         | Optional enabled native ads integration                                                            |
| `packages/tooling`     | Setup/release scripts, config plugin, monetization tooling, PPP dataset, and shared Fastlane lanes |
| `fastlane/.private`    | Gitignored shared store account keys; never included in builds                                     |

Use Node compatible with Expo SDK 57 and **pnpm 10.33.0**. The root `packageManager` pins pnpm. Install once at the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm check:i18n
```

There is one root lockfile. Internal packages use `workspace:*` and the initial native-compatible installation strategy is `nodeLinker: hoisted`. Apps explicitly declare their native dependencies; shared packages declare their consumers as peers. Upgrade Expo, React, and React Native together across apps. No internal package publication or separate package compilation is required.

## Work on an app

Run commands from its directory or select its workspace:

```sh
pnpm --filter @apps/speaker-cleaner start
pnpm --filter @apps/speaker-cleaner ios
pnpm --filter @apps/speaker-cleaner check:i18n
pnpm --filter @apps/speaker-cleaner release:patch --dry-run
```

`src/`, `assets/`, `app.json`, `eas.json`, and `fastlane/` in app-specific instructions are relative to the selected app. Native projects are generated inside each app and are not committed. Regenerate only when native configuration or dependencies change. Never edit generated native source.

Each app retains its own EAS project, bundle/package IDs, scheme, versions, update channel, Firebase files, RevenueCat project, Sentry project, and store metadata. Development adds `.dev` to the canonical identifiers and scheme. Runtime service selection continues to use `__DEV__`.

## Create another app

```sh
pnpm create:app my-app --name "My App" --bundle-id com.rhysle.myapp
pnpm install
cd apps/my-app
pnpm setup:expo
```

The generator copies an explicit list from the maintained starter, connects shared packages, resets version/identities, and rejects conflicting names, identifiers, schemes, and existing directories. It never provisions services or copies local credentials. The identifier is initially used for both iOS and Android; the slug becomes the scheme.

Then configure product assets/copy/legal links and run the app's Firebase and Sentry setup workflows with the documented machine credentials. Configure RevenueCat keys/entitlement and store records separately. Ads start disabled; configure actual IDs before `pnpm setup:ads`. Run the appropriate clean prebuild after native setup. A new app requires its own Firebase setup before a native build; an unconfigured starter can still be bundled for source validation.

## Share improvements

Import shared base UI through `@shared/core/components/base` and other shared modules through their `@shared/core/...` entry points. `@/` means the current app's source, while the `@shared/core` package identifies core-owned source. Do not mirror shared modules with app-local pass-through re-exports. The app-local ads entry point is the exception: setup rewrites it to the enabled package or the core no-op implementation so disabled apps do not depend on ads code. Shared packages must not import app source, app aliases, or product assets.

An app creates a core runtime with its configuration, fonts, themes, ads adapter, and store. Its root `CoreProvider` makes that runtime available to shared hooks. Non-React services receive configuration explicitly. The app root layout still controls navigation and initialization ordering; Sentry initializes before rendering.

Core slice definitions and persistence mechanics are shared. Each app discovers its product slices locally, rejects collisions with core slice names, and creates its own store. Product slice hooks retain their app-local typing. Do not change MMKV IDs, key namespaces, slice names, or persistence formats as a side effect of moving files.

Routes, product events, theme colors, font choice, locale resources, onboarding artwork/content, paywall comparisons, product state, and requests remain app-owned. The shared paywall receives its icon from the app. English is the development source; release localization remains a separate task. Localization audits include shared UI references.

## Credentials and release tooling

Copy the root `.env.fastlane.example` to `.env.fastlane.local` for the **shared** Apple/Google account. Keep `.p8` and Google service-account files under root `fastlane/.private/` or use absolute paths. These keys cannot be overridden in app files.

Copy an app's `.env.fastlane.example` to its `.env.fastlane.local` for its RevenueCat project/API key and optional iOS review recording. Each app owns its Fastlane metadata, screenshots, review configuration, and temporary output. Its tiny Fastfile/Appfile wrappers load one shared implementation. Store URLs and Content Rights are app-owned in `fastlane/ios/app_store_config.json`.

Both Ruby and TypeScript loaders enforce the same ownership rules. Explicit process variables take precedence. Shared credential paths resolve from the repository root, while review attachment paths resolve from the app root, even when supplied through process variables. Quoted values and `export KEY=value` declarations are supported. Empty required values fail validation.

App `.env.local` is for app build settings such as the upload-only Sentry token. Keep provisioning and investigation tokens in a secure machine environment; do not place them in app build files. Never use the upload token for issue investigation. See `AGENTS.md` for Firebase, Sentry, monetization, and localization contracts.

Run setup, metadata, and monetization commands from the selected app:

```sh
pnpm setup:i18n
pnpm setup:font
pnpm setup:ads
pnpm monetization:plan
pnpm monetization:apply
pnpm monetization:activate --confirm
pnpm monetization:verify
pnpm fastlane:ios:metadata
```

Commands keep their existing remote-change semantics. `apply`, activation, price changes, metadata uploads, and provisioning are not local validation commands. Final App Review submission stays manual.
The confirmed activation command also reconciles the app-level Apple Billing Grace Period configured in `src/configs/monetization.ts`; Google grace periods remain store-managed unless explicitly added to the tooling.

## EAS builds and archives

Use the app's `eas-build:*` scripts. They prepare a disposable workspace with only the selected app's local production fallback files, then run EAS from that staged app directory. EAS only reads the repository-root `.easignore`; app-local ignore files cannot select an app by themselves.

Staging avoids rewriting the live repository's ignore rules and permits independent builds. It uses EAS's no-VCS mode in the temporary workspace, so EAS may display a no-VCS warning. Source remains in the real Git repository. The archive includes workspace packages and the root lockfile; it excludes all private Fastlane credentials, sibling app secrets, generated native directories, and development Firebase files. EAS still obtains the selected project's configured production file variables.

```sh
pnpm --filter @apps/speaker-cleaner eas-build:inspect --output /tmp/speaker-cleaner-archive
pnpm --filter @apps/speaker-cleaner eas-build:ios
```

Run submit/update commands from the real app directory. Mobile OTA scripts export only iOS/Android and upload that app's Sentry source maps. A shared source change does not automatically publish any app.

## Verification

`pnpm check` runs lint and TypeScript for both apps and shared packages, including tooling. `pnpm check:i18n` audits each app's English resource and shared references. No automated test files or suites belong in this repository.

Migration provenance and verification results are recorded in `docs/monorepo-migration.md`. Water eject is the initial iOS native validation candidate. Android native builds/runtime, EAS cloud builds, submissions, OTA publication, and remote provisioning are outside migration validation.
