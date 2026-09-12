---
name: app-store-review-notes
description: Prepare Apple App Review Information notes for one Expo app in this monorepo. Use for a new iOS submission, an Apple request for more information, or updates to the selected app's reviewer notes.
---

# App Store Review Notes

Create evidence-based reviewer notes for one app and write them to that app's Fastlane metadata. Do not upload metadata or submit a build.

## Select the app

Work from the repository root. Resolve exactly one directory under `apps/`:

- Use `apps/<slug>` when the user names an app.
- When invoked from inside `apps/<slug>`, infer that app.
- Otherwise list app directories containing both `app.json` and `fastlane/` and ask which app to use if more than one qualifies.

Call the result `APP_DIR`. All unqualified project paths below are relative to `APP_DIR`. Never reuse values, screenshots, credentials, metadata, or product claims from a sibling app.

## Gather evidence

Read the selected app's:

- `app.json`, `package.json`, and `docs/PRODUCT.md`;
- `src/configs/AppConfig.ts`, `src/configs/monetization.ts`, English locale, routes, paywall, settings, auth, and permission-related code when present;
- `fastlane/ios/metadata/en-US/description.txt`, `keywords.txt`, and existing review notes;
- app `.env.fastlane.example` only for the names and purpose of review-related settings, never local secret values.

Also inspect `packages/core` and `packages/ads` only where the selected app actually consumes shared behavior. Shared dependencies are evidence of availability, not proof that a feature is enabled in this app. Read actual code and configuration before making a claim.

Build a factual inventory of:

- app purpose, target user, and distinctive shipped benefits;
- sensitive permissions and how reviewers reach the related behavior;
- authentication, account creation, and account deletion;
- subscriptions or lifetime purchases, benefits, durations, entitlement management, purchase paths, and Restore Purchases;
- ads, analytics, crash reporting, remote data providers, and other non-build runtime services;
- regional gating, supported locales, user-generated content, and regulated or protected material.

Do not expose developer handles, organization names, owner fields, bundle-id ownership, internal project identifiers, API keys, account values, or local credentials. Do not list Expo, EAS, packages, frameworks, or build tooling as reviewer-facing external services.

If the user supplies Apple's rejection or information-request text, mirror its requested sections and order exactly. Otherwise use the compact eight-section structure below.

## Write the notes

Replace `APP_DIR/fastlane/ios/metadata/review_information/notes.txt` with plain text and a trailing newline. Preserve no previous-release boilerplate that is no longer accurate.

1. `SCREEN RECORDING`: attachment location and a concise coverage list. Do not claim a recording exists unless verified; use a focused `[TODO]` when needed.
2. `DEVICES & OS TESTED`: one physical device and iOS pair per line. This cannot be inferred from code, so retain `[TODO: add every physical device and iOS version actually tested]` until supplied.
3. `PURPOSE & AUDIENCE`: one sentence each for what the app does, who it serves and why, what distinguishes its workflow, and 1–3 demonstrable shipped features. Never invent a differentiator.
4. `SETUP`: account requirements, exact navigation, demo credentials placeholders when authentication exists, paywall and Restore Purchases paths when applicable.
5. `EXTERNAL SERVICES`: only verified non-build runtime providers and their short purpose, followed by concise privacy behavior.
6. `REGIONAL DIFFERENCES`: actual gating or a consistency statement, plus supported locales and RTL when useful.
7. `REGULATED INDUSTRY / PROTECTED MATERIAL`: factual declarations with a confirmation TODO where code cannot prove ownership or authorization.
8. `IN-APP PURCHASES`: every enabled product and benefit, exact purchase paths, Apple In-App Purchase, and Restore Purchases. If none exist, say so explicitly.

Use ASCII punctuation, semantic line breaks, at most one blank line between sections, and no decorative separators, marketing filler, or unsupported claims. Keep every sentence or distinct field on its own line.

The App Store Connect Notes field is limited to 4,000 bytes. Aim below 3,500 bytes so TODO replacements have room.

## Verify and hand off

Before finishing:

- run `wc -c` on the selected app's notes and keep the result below 4,000;
- confirm every service, permission, product, and navigation path against the selected app;
- confirm no sibling-app or private values entered the file;
- inspect the diff and list every remaining `[TODO]` as a checklist;
- report the absolute path and byte count;
- remind the user that a review recording is uploaded separately through App Store Connect when one is required.

Do not run Fastlane, upload metadata, select a build, or submit for review unless the user separately requests that external action.
