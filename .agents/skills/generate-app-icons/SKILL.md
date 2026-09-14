---
name: generate-app-icons
description: Create or import production app icons for one Expo app in this monorepo. Use for app icon design, splash icon artwork, Android adaptive icons, Play Store icons, or an app visual-identity update.
---

# Generate App Icons

Create icon assets for exactly one app under `apps/`, update only that app's `app.json`, and leave sibling apps unchanged.

## Select the app

Work from the repository root. Use the app named by the user, infer `apps/<slug>` from the current directory, or ask when multiple apps remain possible. Validate that `apps/<slug>/app.json` exists and call its slug `APP_SLUG`.

Read the selected app's `app.json`, `docs/PRODUCT.md`, `src/theme/`, English store description, and current icon assets for product and palette context. Shared template content is not product evidence. Do not expose or reproduce developer handles, owner values, organization names, bundle identifiers, credentials, or sibling-app branding.

## Use Codex image generation

Invoke `$imagegen` and follow its current instructions for every generation or edit. This repository-local skill uses Codex's built-in image workflow.

Resolve `SKILL_DIR` from this skill's loaded absolute path. The repository already provides `sharp` at the workspace root for deterministic inspection and variant generation.

Create a task-specific temporary directory:

```bash
ICON_WORK_DIR="$(mktemp -d /tmp/template-expo-icons.XXXXXX)"
```

### User-provided icon

Use the supplied image immediately; skip concept ideation and selection. View it at full resolution, then run:

```bash
node "$SKILL_DIR/scripts/inspect-source.js" --source "/absolute/path/to/icon.png"
```

The iOS/base source must become a square, opaque, full-bleed PNG without a baked-in rounded mask. If the source has transparent rounded corners or an obvious rounded boundary, use an `$imagegen` edit to preserve the subject, colors, proportions, lighting, and composition while extending only the existing background into the corners. Save the normalized 1024×1024 PNG under `ICON_WORK_DIR` and inspect it again. If safe reconstruction is impossible, ask for the original unmasked source.

### No supplied icon

Summarize the selected app's purpose, audience, and palette. Propose three materially different prompts: symbolic/abstract, literal/object, and character/playful. Each prompt must specify an opaque full-bleed square background, a simple silhouette that survives 20–48 px display, no text or letters, no device mockup, no rounded mask, and no watermark.

After the user confirms the directions, invoke `$imagegen` once per concept, show the results, and let the user select or regenerate one. Save the selected 1024×1024 PNG under `ICON_WORK_DIR` as the iOS/base source.

## Create the Android foreground

Invoke `$imagegen` once in edit mode against the selected base source. Preserve the primary colored subject and recognizable details, remove all background and background shadows, and place the subject on a transparent 1024×1024 canvas. Keep essential artwork within the centered 66/108 safe zone and the outer 18/108 transparent. Do not leave an inset square, plate, mask, border, text, or new elements.

Save it under `ICON_WORK_DIR` and view it over the intended background. Choose one opaque `#RRGGBB` adaptive background matching the base icon's edge or selected app palette. Ask only when multiple materially different choices remain.

## Generate app-owned variants

From the repository root run:

```bash
node "$SKILL_DIR/scripts/generate-variants.js" \
  --app "$APP_SLUG" \
  --source "$ICON_WORK_DIR/ios-source.png" \
  --android-foreground "$ICON_WORK_DIR/android-foreground.png" \
  --background-color "#FFFFFF"
```

Replace the source paths and color with the actual selected values. The script writes only:

- `apps/<slug>/assets/icons/ios-icon.png` — 1024×1024 opaque iOS light/dark and fallback icon;
- `apps/<slug>/assets/icons/splash-icon.png` — centered splash artwork with transparent rounded corners;
- `apps/<slug>/assets/icons/ios-icon-tinted.png` — grayscale iOS tinted starting point;
- `apps/<slug>/assets/icons/android-icon-adaptive.png` — transparent colored adaptive foreground;
- `apps/<slug>/fastlane/android/metadata/en-US/images/icon.png` — 512×512 Play Store icon.

## Update and verify app config

Patch only `apps/<slug>/app.json` while preserving unrelated fields:

- `expo.icon`: `./assets/icons/ios-icon.png`
- `expo.ios.icon.light` and `.dark`: `./assets/icons/ios-icon.png`
- `expo.ios.icon.tinted`: `./assets/icons/ios-icon-tinted.png`
- `expo.android.adaptiveIcon.foregroundImage`: `./assets/icons/android-icon-adaptive.png`
- `expo.android.adaptiveIcon.backgroundColor`: the chosen color
- existing splash plugin image: `./assets/icons/splash-icon.png`

Do not add `android.icon`, `monochromeImage`, a separate background image, or a splash configuration that did not already exist. Remove stale icon references only inside the selected app.

View every generated asset and verify dimensions, opacity/alpha intent, full-bleed iOS corners, Android safe-zone behavior under several masks, small-size legibility, and the tinted asset's contrast. Run `pnpm --filter @apps/<slug> prebuild:clean` because `app.json` icon configuration affects generated native projects, then report all selected-app files changed. Do not upload store metadata.
