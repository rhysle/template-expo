---
name: generate-feature-graphic
description: Create the 1024×500 Google Play feature graphic for one Expo app in this monorepo. Use when asked for a Play Store feature graphic, banner, header image, or replacement featureGraphic.png.
---

# Generate Feature Graphic

Create one Google Play feature graphic for exactly one app and save it in that app's Fastlane tree. Do not upload store metadata.

## Select the app and screenshot

Work from the repository root. Use the user-named app, infer `apps/<slug>` from the current directory, or ask when more than one app remains possible. Validate `apps/<slug>/app.json` and call the slug `APP_SLUG`.

Read the selected app's `app.json`, `docs/PRODUCT.md`, theme, English store listing, and current `featureGraphic.png` when present. Do not use sibling-app assets or branding. Do not expose developer handles, owner fields, organization names, bundle identifiers, credentials, or internal project IDs.

Use a screenshot the user supplied. Otherwise inspect `apps/<slug>/assets/screenshots/android/`, show the available images, and choose the strongest representation of the app's core benefit with the user. Prefer a high-resolution screen with little small text.

## Generate with Codex

Invoke `$imagegen` and follow its current instructions. This repository-local skill uses Codex's built-in image workflow.

View the selected screenshot before editing it. Use an edit prompt with this intent:

```text
Use case: ads-marketing
Asset type: Google Play feature graphic
Primary request: Create a polished wide feature graphic for "<APP_NAME>" using the supplied real app screenshot as the hero visual inside a modern Android phone frame.
Composition/framing: 1024:500 landscape composition; keep the device and critical content away from crop edges; use the selected app's evidenced palette and visual tone.
Constraints: preserve the screenshot UI and aspect ratio exactly; do not invent or alter UI; no watermark, unsupported claims, fake awards, social proof, download counts, testimonials, or developer branding; add text only when the user requests it or approved copy is already supplied.
```

Follow `$imagegen` output handling and retain the generated image's absolute path.

## Normalize into the selected app

Resolve `SKILL_DIR` from this skill's loaded absolute path. From the repository root run:

```bash
node "$SKILL_DIR/scripts/write-feature-graphic.js" \
  --app "$APP_SLUG" \
  --input "/absolute/path/to/generated-image.png"
```

The script writes an opaque 1024×500 PNG to:

`apps/<slug>/fastlane/android/metadata/en-US/images/featureGraphic.png`

View the final file and verify its dimensions, crop, screenshot fidelity, legibility, safe margins, absence of alpha, and consistency with the selected app. If normalization clips important content, regenerate with wider safe margins instead of accepting a damaged crop.

Report the absolute path and that it is ready for the selected app's Fastlane metadata flow. Do not run `fastlane:android:metadata` unless the user separately authorizes that remote upload.
