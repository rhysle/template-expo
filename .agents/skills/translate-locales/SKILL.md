---
name: translate-locales
description: "Translate an app's non-English i18next JSON locale files from its finalized English resource for release, using product context and natural locale-specific phrasing."
---

# Translate App Locales

Translate the complete English source locale into every existing non-English locale for one app in this monorepo. Make the copy read naturally in the target language and fit the app's actual product and UI context.

## Choose the app and locale files

- Resolve one app from the current task: use an app named in the conversation, the app directory containing the current working context, or the single app clearly indicated by recent work. If multiple apps remain plausible, ask which app to translate before editing.
- Use that app's `src/i18n/locales/en.json` as the source and every existing sibling `*.json` file except `en.json` as a target. Do not ask the user to list languages.
- Translate the full current resource so each target matches the English key structure. Do not change `en.json`, TypeScript source, locale configuration, or other apps. Do not add or remove locale files as part of translation.
- If the selected app has no English source or no non-English locale files, explain what is missing and stop.

## Understand the product before translating

Read the app's product documentation when present, app name and configuration, and the relevant route/component/service for the keys being translated. Search source usage by key when the English value alone leaves the feature, audience, action, or state unclear. For strings consumed by shared core UI, inspect the relevant shared component or service as well. Use that evidence to understand what the user sees and does; do not guess from key names alone.

Translate the intent, not the English sentence structure. Use idiomatic, concise language a native speaker would expect in a mobile app. Keep terminology consistent across screens, use normal UI wording for each language, and adapt grammar, word order, formality, punctuation, and capitalization to the target locale. Respect regional distinctions represented by separate files (for example, `es` and `es-MX`, `fr` and `fr-CA`, `pt` and `pt-BR`, and `zh-Hans` and `zh-Hant`); do not copy one regional translation into another without adapting it.

Keep product and brand names, URLs, identifiers, and intentional technical terms intact. Preserve interpolation tokens such as `{{count}}` exactly, including their spelling and number of occurrences. Preserve i18next plural key suffixes, markup or formatting tokens, meaningful line breaks, and the original meaning and strength of claims. Do not add promises, product capabilities, legal meaning, or instructions that are absent from the source. Rephrase to fit UI controls and messages; do not leave English sentences in a locale just to satisfy key parity. Language-neutral names or terms may remain unchanged when that is the natural local usage.

When product evidence does not resolve a meaning that materially changes the translation, ask a concise question about that term or behavior and continue with other unambiguous strings. Do not ask for approval of individual translations or for a language list.

## Verify and report

After translating, check that each target is valid JSON, has the same nested keys as `en.json`, contains no blank translation values, and preserves every interpolation placeholder. Review representative UI strings in context for natural phrasing and consistent terminology, with extra care for short buttons, plural messages, errors, purchases, permissions, and region-specific variants.

From the repository root, run the selected app's release locale audit:

```bash
pnpm --filter @apps/<slug> check:i18n:release
```

Fix locale-file issues revealed by the audit and rerun it. The audit also checks English source quality; if it reports an English-source issue, leave `en.json` unchanged and report that separate blocker. Do not use the `:fix` audit command, since it can remove keys and edit locale sources.

Inspect the final diff and report the selected app, translated locale codes, changed-file count, and audit result. Mention any unresolved source-context question or English-source blocker explicitly.
