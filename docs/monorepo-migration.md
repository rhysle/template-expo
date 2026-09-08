# Monorepo migration

Implemented on `feat/monorepo`.

## Provenance and ownership

- Starter source: `ba2cc37df7b40e02d46b97e0c00d7ee76ba77f3e`.
- Water eject source: `0c4eacb289d98178a346d6adbf3235c20aa5fe1e` from `feat/water-eject`.
- All 554 tracked water-eject assets, locale resources and store metadata files match that snapshot byte-for-byte. Its canonical identifiers, slug, version, owner, EAS project and update associations are unchanged.
- Starter has independent identifiers and no water-eject Firebase files, RevenueCat keys, Sentry DSN, store ID or EAS association. Ads and OTA are disabled until configured.
- Runtime/UI/state/service implementations live in `packages/mobile-foundation`; enabled ads live in `packages/ads`; scripts/plugins/PPP/Fastlane implementations live in `packages/tooling`. Product configuration and composition remain app-owned.

## Validation completed on 2026-09-08

- Root `pnpm check`: lint and TypeScript passed for both apps and all three shared packages.
- Root `pnpm check:i18n`: both English development audits passed, including shared UI references. Release translation parity was not requested.
- Clean isolated `pnpm install --offline --frozen-lockfile`: passed using the installed pnpm cache with no existing node_modules. One root lockfile and pnpm 10.33.0 are retained.
- Both apps resolve the same React 19.2.3, React Native 0.86.2, Expo 57.0.11, MMKV 4.3.2, Reanimated 4.5.1, Firebase app 24.1.1 and RevenueCat 10.4.2 installations. Original resolved direct versions were preserved.
- Development and production Expo public configuration passed for both apps, including both platform identifiers and the development suffix convention.
- TypeScript/Ruby environment parity checks passed for quoted/export declarations, process overrides, root/app relative paths, ownership rejection and root-command rejection. Fastlane local validation confirmed selected metadata, required nonempty credentials and missing-attachment preservation.
- Disposable generated app passed lint/types, clean identity/secret checks and local monetization configuration validation. Directory, canonical identifier and development identifier conflicts were rejected without partial output. Local font, locale and ads setup left sibling files unchanged. Release patch dry-run passed. The disposable app was removed afterward.
- Final local water-eject iOS EAS archive inspection passed. Workspace source and lockfile are present, with only water-eject production fallback files. Private credentials, Fastlane local environments, sibling secrets, development Firebase files and native trees are excluded. No cloud build was started.
- Starter production iOS source bundle passed independently through the shared packages.
- Water eject clean iOS prebuild and CocoaPods installation passed. Xcode Debug simulator build succeeded using `SpeakerCleanerDev.xcworkspace` / `SpeakerCleanerDev`.
- Installed over the existing `com.rhysle.speakercleaner.dev` simulator app without uninstalling. Both existing MMKV files were byte-for-byte unchanged immediately after installation.
- Runtime checks passed for all four tabs, cleaning completion, tone frequency/play/stop, stereo play/stop, settings, Vietnamese localization preview, paywall offerings/full comparison content, and development banner/interstitial ads.
- Existing August/September cleaning and sound records were visible using the app's local premium debug override. Tone and haptics preferences persisted across a full process restart. Original preference values and system locale were restored; the runtime-only premium override was cleared by restart. One new 30-second cleaning verification record remains in local history.

## Local files

Existing root app environment and Firebase files were verified against water-eject destination copies before redundant root copies were removed. Original files remain backed up under gitignored `fastlane/.private/pre-monorepo-local-files/`; the original combined Fastlane environment is also backed up privately. The provisioning token was excluded from the app build environment. Shared Apple/Google credentials remain root-owned, and no product credentials were copied to starter.

Old ignored root native/build caches may still exist from the pre-migration checkout; they are not used by workspace commands or included in archives. The active generated iOS project is `apps/water-eject/ios/`.

## Deferred checks and limits

- Onboarding runtime verification is explicitly deferred to the user, as requested. The disposable onboarding simulator was removed without changing the existing installation.
- Android native prebuild/build/runtime remain unverified. Both platforms received TypeScript/configuration validation only.
- Runtime validation used an iOS simulator. Physical speaker output, microphone accuracy and physical-device behavior remain device QA work; no microphone permission was added for this migration.
- Starter external integrations remain intentionally unconfigured; native Firebase setup is required before building a new product.
- No automated test suite, remote provisioning, monetization mutation, store upload, cloud build or OTA publication was performed.
