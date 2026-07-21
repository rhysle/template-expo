# Eject Focused Layout Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recompose the Eject tab around one dominant action so its normal idle and running states fit comfortably within the mobile viewport while preserving safety, error, and accessibility behavior.

**Architecture:** Add an opt-in focused variant to the shared audio screen shell, then make Eject switch its central hero by state: mascot while idle/completed, timer ring while starting/running. Keep exceptional notices in the existing scroll fallback so small screens and large text remain usable.

**Tech Stack:** Expo Router, React Native 0.86, TypeScript, react-i18next, phosphor-react-native, the project theme system, and existing audio controller components.

---

### Task 1: Preserve the selected design reference

**Files:**

- Create: `docs/design/references/eject-focused-option-1.png`

1. Copy the user-selected Option 1 image into the repository as the immutable visual reference for implementation and QA.
2. Confirm its aspect ratio matches the target phone viewport closely enough for direct comparison.

### Task 2: Add the focused audio screen shell

**Files:**

- Modify: `src/components/audio/AudioToolScreen.tsx`

1. Add an optional `variant` prop with `default` and `focused` values.
2. Keep the existing under-tab-bar inset behavior unchanged for default consumers.
3. For the focused variant, let `TabScreen` reserve navigation space, tighten vertical padding, and allow the content column to grow to the available viewport.
4. Retain `ScrollView` as an accessibility and compact-device fallback.

### Task 3: Recompose the Eject screen

**Files:**

- Modify: `src/app/(tabs)/(eject)/index.tsx`

1. Move the ready/running status badge above the subtitle to match the selected composition.
2. Use `useWindowDimensions` to select compact hero sizes on shorter screens.
3. Render the mascot as the idle/completed hero and the progress ring as the starting/running hero, never both at once.
4. Keep one large primary button and its label directly below the current hero.
5. Present the placement/running guidance as a concise icon-and-text safety cue.
6. Remove the always-visible explanation card and generic gradual-volume notice from the main surface.
7. Preserve external-route, interrupted-session, and error notices after the primary interaction.

### Task 4: Verify code quality and behavior

**Files:**

- Verify: `src/components/audio/AudioToolScreen.tsx`
- Verify: `src/app/(tabs)/(eject)/index.tsx`

1. Run `npm run check`.
2. Repair any type, lint, formatting, compiler, or localization failures caused by the refactor.
3. Launch the existing simulator build and verify idle and running interactions remain functional.

### Task 5: Complete visual design QA

**Files:**

- Create: `design-qa.md`
- Create: `docs/design/implementation/2026-07-21/eject-idle.png`
- Create: `docs/design/implementation/2026-07-21/eject-running.png`
- Create: `docs/design/implementation/2026-07-21/eject-idle-comparison.png`

1. Capture idle and running screenshots at the same simulator viewport.
2. Place the selected source image and idle implementation screenshot in one side-by-side comparison image.
3. Inspect hierarchy, spacing, tab-bar clearance, clipping, Dynamic Type fallback, and control reachability.
4. Iterate on the implementation if the comparison reveals material mismatches.
5. Record the source, viewport, state coverage, comparison artifact, findings, iteration history, and final passed/blocked result in `design-qa.md`.
