---
name: release-notes
description: Prepare App Store and Google Play release notes for one app in this monorepo. Use when drafting reviewer notes, What's New copy, Play changelogs, or translating approved release notes for an iOS, Android, or combined mobile release.
---

# Store Release Notes

Create evidence-based release metadata for one app without uploading or submitting it.

Typical invocations:

- Codex: `$release-notes for speaker-cleaner on ios`, `$release-notes for speaker-cleaner on android`, or `$release-notes for speaker-cleaner on both`.
- Claude Code: `/release-notes for speaker-cleaner on ios`, `/release-notes for speaker-cleaner on android`, or `/release-notes for speaker-cleaner on both`.
- After reviewing Phase 1: `Approve these notes and translate them for the same app and platforms.`

## Required scope

Resolve these inputs before writing:

- **App:** an app directory under `apps/` that contains `app.json` and `fastlane/`. If the user names it, use that app. If invoked from inside one app, infer that app. If more than one app remains possible, ask which app to update.
- **Platforms:** exactly `ios`, `android`, or `both`. Infer this only when the request makes it unambiguous; otherwise ask.
- **Release changes:** use a user-provided comparison range or change summary when supplied. Otherwise inspect the selected app's version, relevant git tags and history, the branch diff from its merge base with the default branch, and uncommitted changes. If those sources do not identify the release boundary confidently, ask for the previous release ref or a change summary before writing.

Scope changes to the selected app. Include changes in shared packages only when they affect that app. Exclude changes that affect only sibling apps, internal tooling, development workflows, or store metadata with no user-visible/runtime effect. Read actual diffs where needed; commit subjects alone are not sufficient evidence. Never invent behavior, test steps, or credentials.

## Target files

Paths below are relative to the selected app:

| Platform | Audience | English target |
| --- | --- | --- |
| iOS | Apple reviewer | `fastlane/ios/metadata/review_information/notes.txt` |
| iOS | Users | `fastlane/ios/metadata/en-US/release_notes.txt` |
| Android | Users | `fastlane/android/metadata/en-US/changelogs/default.txt` |

Only touch targets for the selected platforms. Android has no reviewer-note target. Replace each target's entire contents; old notes describe a previous version and must not be retained or appended.

## Phase 1: English draft

Write the selected English targets, then stop for review. Do not translate in this phase, even when localized files already exist.

For the Apple reviewer note:

- Be concise, factual, professional, and easy to scan.
- Identify the version, summarize every review-relevant behavior change, and provide exact navigation paths or short test steps for new or changed behavior.
- Mention prerequisites, permissions, purchases, account state, device conditions, or platform limitations only when relevant and verified.
- Include small internal fixes only when they affect review, compliance, access, or the ability to test a changed feature.
- Do not include customer-facing marketing, ASO requests, revenue anecdotes, praise-seeking, or unrelated history.
- Prefer a compact structure such as a version heading, bullets, and a final `Reviewer paths:` line. Stay within 4,000 characters.

For user-facing release notes:

- Describe meaningful benefits and noticeable fixes in plain language. Prioritize features, workflow improvements, reliability, performance, privacy, and accessibility that users can experience.
- Omit implementation details and trivial visual tweaks such as isolated border, spacing, or color changes unless they materially improve usability or accessibility.
- Use a short opening or version label plus roughly 1–5 compact bullets when that fits the release. Do not overstate the changes.
- Tailor the iOS and Android copy when platform behavior differs; identical copy is fine when the shipped experience is the same.
- Keep iOS release notes within 4,000 characters and each Android changelog within 500 characters.

After editing, show the complete English text, identify every changed file, summarize the evidence/range used, and ask the user to approve or request edits. Do not treat silence or a request to draft notes as translation approval.

## Phase 2: Localize after approval

Begin only after the user explicitly approves the Phase 1 English text or explicitly asks to translate that approved draft.

- Treat the current selected English target as the source of truth.
- For iOS, overwrite `release_notes.txt` in every existing locale directory under `fastlane/ios/metadata/` except `en-US` and `review_information`.
- For Android, overwrite `changelogs/default.txt` in every existing locale directory under `fastlane/android/metadata/` except `en-US`.
- Translate only user-facing release notes. Never translate or duplicate Apple's reviewer note.
- Translate naturally for each locale and region while preserving meaning, product/feature names, numbers, bullets, and claims. Do not add claims that are absent from English.
- Preserve the applicable store character limit in every locale. Tighten wording rather than dropping a major change when a translation is too long.
- Do not create speculative locale directories. Report any existing locale target that is missing or cannot be updated.

## Verification and handoff

Inspect the final diff and verify:

- only the selected app and platforms changed;
- every selected target was replaced rather than appended;
- English files match the approved copy;
- Phase 2 covered every existing selected-platform locale target;
- all files are plain text with a trailing newline and remain within their platform limits.

Report changed-file counts and any missing locale targets. Do not run Fastlane upload, submission, deployment, or release commands unless the user separately asks for that action.
