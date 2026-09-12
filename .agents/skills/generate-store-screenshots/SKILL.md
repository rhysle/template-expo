---
name: generate-store-screenshots
description: Turn real captures into App Store and Google Play marketing screenshots for one app in this monorepo. Use when asked to generate, redesign, or refresh store screenshots for iPhone, iPad, or Android.
---

# Generate Store Screenshots

Create marketing screenshots from real selected-app captures and write them directly into that app's Fastlane upload tree. Never mix apps, locales, devices, or screenshot slots.

## Select scope

Work from the repository root. Resolve one user-named app, infer `apps/<slug>` from the current directory, or ask when several apps qualify. Validate `apps/<slug>/app.json` and call the slug `APP_SLUG`.

Resolve the requested platforms and locales. If omitted, ask rather than generating every localized asset. The supported repository source folders are:

- `apps/<slug>/assets/screenshots/iphone/`
- `apps/<slug>/assets/screenshots/ipad/`
- `apps/<slug>/assets/screenshots/android/`

Source filenames use a numeric slot and locale, such as `0_en-US.png`. Treat each existing source as the real UI reference for that exact app, device, locale, and slot. Do not borrow missing files from a sibling app or silently substitute English for another locale.

Read the selected app's product docs, theme, English store listing, and relevant locale copy for creative context. Do not expose developer handles, owner or organization values, bundle identifiers, credentials, internal project IDs, or developer branding.

## Approve the message

View every selected source at full resolution before proposing creative direction. If the user has not supplied headlines or themes, offer two benefit-focused directions per slot based only on visible UI and shipped behavior. Record the approved direction for each slot. Keep marketing claims supportable from the selected app.

## Generate with Codex

Invoke `$imagegen` and follow its current instructions. This repository-local skill uses Codex's built-in image workflow.

Use one edit call per asset. Supply the real screenshot as the edit target and use this intent:

```text
Use case: ads-marketing
Asset type: mobile store marketing screenshot for <DEVICE> and <LOCALE>
Primary request: Build a polished store-listing composition focused on this approved benefit: <BENEFIT>.
Input image: the supplied image is the real UI screenshot and must remain visually exact inside the composition.
Constraints: preserve the UI and its aspect ratio; do not crop, stretch, zoom, translate, redraw, or invent UI; surrounding layout and approved concise headline may be created; use the selected app's evidenced visual system; no app icon unless requested; no watermark, fake social proof, trust badge, user count, download count, award, testimonial, or unsupported claim.
```

Keep platform families visually coherent while respecting localized text length. Follow `$imagegen` output handling and retain each generated image's absolute path.

## Normalize into Fastlane

Resolve `SKILL_DIR` from this skill's loaded absolute path. For each output, run from the repository root:

```bash
node "$SKILL_DIR/scripts/write-store-screenshot.js" \
  --app "$APP_SLUG" \
  --platform iphone \
  --locale en-US \
  --slot 0 \
  --input "/absolute/path/to/generated-image.png" \
  --reference "apps/$APP_SLUG/assets/screenshots/iphone/0_en-US.png"
```

Use `iphone`, `ipad`, or `android`. The script adopts the exact reference dimensions and writes an opaque PNG to the repository's existing Fastlane convention:

- iPhone: `apps/<slug>/fastlane/ios/screenshots/<locale>/<slot>_APP_IPHONE_67_<slot>.png`
- iPad: `apps/<slug>/fastlane/ios/screenshots/<locale>/<slot>_APP_IPAD_PRO_3GEN_129_<slot>.png`
- Android: `apps/<slug>/fastlane/android/metadata/<locale>/images/phoneScreenshots/<slot>_<locale>.png`

This skill does not manufacture Android tablet screenshots from phone captures. Add a repository-owned tablet source convention first if tablet output is needed.

## Verify and report

View every normalized output and verify exact reference dimensions, opacity, screenshot fidelity, readable localized copy, safe margins, device consistency, ordering, and absence of unsupported claims. Regenerate any asset whose center crop damages the composition.

Report generated counts grouped by platform and locale, absolute output paths, and any skipped or failed source. Do not run Fastlane metadata uploads unless the user separately requests that external action.
