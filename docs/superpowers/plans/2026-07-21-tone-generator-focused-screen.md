# Tone Generator Focused Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose Tone Generator into the approved mascot-led, one-screen instrument with a Design 2-style waveform gauge and an always-visible Play/Stop dock.

**Architecture:** Extend the shared audio screen shell with an optional focused footer so the instrument can scroll independently while the primary audio action stays above navigation. Keep all oscillator, logarithmic-frequency, persistence, and accessibility behavior in the existing Tone screen; only reorganize the screen composition and add a reusable preset sheet using existing base components.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, TypeScript strict mode, React Compiler, react-i18next, Reanimated 4, React Native Gesture Handler, Skia, and the existing themed component system.

## Global Constraints

- Preserve the approved visual source at `docs/design/references/tone-generator-focused-approved.png`.
- Keep the existing mascot asset; do not generate or add production artwork.
- Preserve the 20–20,000 Hz logarithmic mapping, live oscillator updates, debounced persistence, haptics, error behavior, and lifecycle cleanup.
- Keep all Play/Stop controls fully above the native tab bar in every playback state.
- Keep every interactive target at least 44 points and retain reduced-motion behavior.
- Use theme tokens, `createThemedStyles`, `useThemedStyles`, `iconSizes`, and `withAlpha`; do not introduce raw visual colors or the legacy Animated API.
- Add any production copy to every shipped locale and pass `npm run check:i18n`.
- Do not modify `ios/`, `android/`, audio services, persistence schemas, analytics, routing, settings, or other tool tabs.

---

### Task 1: Add an optional focused footer to the audio screen shell

**Files:**

- Modify: `src/components/audio/AudioToolScreen.tsx:1-60`

**Interfaces:**

- Consumes: existing `variant?: 'default' | 'focused'` and `contentStyle?: StyleProp<ViewStyle>` props.
- Produces: `footer?: ReactNode`, rendered outside the scroll view only when provided.

- [ ] **Step 1: Add the footer contract and layout container**

Update the imports and props to use this exact public contract:

```tsx
import type { PropsWithChildren, ReactNode } from 'react'

interface AudioToolScreenProps extends PropsWithChildren {
  contentStyle?: StyleProp<ViewStyle>
  footer?: ReactNode
  variant?: 'default' | 'focused'
}
```

Destructure `footer`, wrap the scroll view and footer in a full-height container, and preserve the current behavior when no footer exists:

```tsx
<TabScreen contentUnderTabBar={!isFocused}>
  <View style={styles.screen}>
    <ScrollView
      style={styles.scroll}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.scrollContent,
        isFocused && styles.focusedScrollContent,
        { paddingBottom: isFocused ? spacing.lg : spacing['4xl'] + bottomInset },
      ]}
      scrollIndicatorInsets={isFocused ? undefined : { bottom: bottomInset }}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.content, isFocused && styles.focusedContent, contentStyle]}>
        {children}
      </View>
    </ScrollView>
    {footer ? <View style={styles.footer}>{footer}</View> : null}
  </View>
</TabScreen>
```

Add theme styles with no absolute positioning or overlap:

```tsx
screen: { flex: 1 },
scroll: { flex: 1 },
footer: {
  width: '100%',
  maxWidth: 720,
  alignSelf: 'center',
  paddingHorizontal: t.spacing.lg,
  paddingTop: t.spacing.sm,
  paddingBottom: t.spacing.md,
},
```

- [ ] **Step 2: Verify the shared contract**

Run: `npm run check:type`

Expected: PASS with no TypeScript errors. Existing Eject, Stereo Test, and dB Meter layouts compile unchanged because `footer` is optional.

- [ ] **Step 3: Commit the shell change**

```bash
git add src/components/audio/AudioToolScreen.tsx
git commit -m "feat(audio): support focused tool footer"
```

---

### Task 2: Recompose Tone Generator around the approved instrument and action dock

**Files:**

- Modify: `src/app/(tabs)/tone-generator/index.tsx:1-255`

**Interfaces:**

- Consumes: `AudioToolScreen.footer`, existing `BottomSheet`, `ChoiceChip`, `CircularAudioButton`, `FrequencyWaveform`, `MascotHero`, `NativeSlider`, `StatusBadge`, and the current audio controller APIs.
- Produces: a focused Tone screen with stable footer action, four quick presets, and a six-preset sheet.

- [ ] **Step 1: Define preset groups and responsive state**

Import `SlidersHorizontalIcon` and `SpeakerLowIcon` from `phosphor-react-native`, add `useWindowDimensions`, and import `BottomSheet`, `Pressable`, and `iconSizes` through their existing aliases.

Replace the single preset constant with:

```tsx
const PRESETS = [165, 250, 440, 1_000, 8_000, 12_000] as const
const QUICK_PRESETS = PRESETS.slice(0, 4)
```

Inside the screen, add:

```tsx
const { height } = useWindowDimensions()
const [isPresetSheetVisible, setIsPresetSheetVisible] = useState(false)
const isCompactLayout = height < 900
```

- [ ] **Step 2: Centralize preset selection**

Add one handler so quick chips and sheet chips cannot diverge:

```tsx
const selectPreset = (preset: (typeof PRESETS)[number], dismissSheet = false) => {
  setFrequencyHz(preset)
  if (isRunning) audioController.setToneFrequency(preset)
  if (dismissSheet) setIsPresetSheetVisible(false)
}
```

Keep `applyFrequencyPosition`, `adjustFrequency`, waveform pan handling, persistence, and `handleMainPress` unchanged.

- [ ] **Step 3: Build the persistent action dock**

Create the footer before the return statement:

```tsx
const actionDock = (
  <View style={[styles.actionDock, isCompactLayout && styles.actionDockCompact]}>
    <CircularAudioButton
      active={isActive}
      loading={isStarting || snapshot.status === 'stopping'}
      haptic={hapticsEnabled}
      accessibilityLabel={isActive ? t('audioTools.tone.stop') : t('audioTools.tone.play')}
      onPress={handleMainPress}
    />
    <Text variant="subtitle" weight="semibold" tone="accent" align="center">
      {isActive ? t('audioTools.tone.stop') : t('audioTools.tone.play')}
    </Text>
    <View style={styles.safetyCue}>
      <SpeakerLowIcon
        size={iconSizes.md}
        color={theme.colors.text.secondary}
        weight="regular"
      />
      <Text variant="caption" tone="secondary" align="center" style={styles.safetyText}>
        {t('audioTools.tone.volumeHint')}
      </Text>
    </View>
  </View>
)
```

Pass it with `<AudioToolScreen variant="focused" footer={actionDock}>`. Remove the old in-scroll `playSection` and generic gradual-volume `InlineNotice`.

- [ ] **Step 4: Reorder and resize the visual hierarchy**

Recompose the scroll content in this exact order:

1. `StatusBadge` for `bandLabels[band]`.
2. Existing subtitle.
3. Compact `MascotHero`, active only while running and colored by `waveformColor`.
4. Current-frequency label and large tabular value.
5. Existing adjustable `FrequencyWaveform` inside a shallow panel; pass a compact screen style when `isCompactLayout`.
6. Existing native slider and 20/20,000 Hz endpoint labels.
7. Quick presets and the Presets action.
8. Existing error notice when the last tone session fails.

Use `compact` on the mascot for all screen heights and constrain its slot through screen styles. Do not add a second illustration, timer, volume control, or history.

- [ ] **Step 5: Implement quick presets and the full preset sheet**

Render `QUICK_PRESETS` as compact `ChoiceChip` controls. Add a 44-point `Pressable` with `SlidersHorizontalIcon`, the existing `audioTools.tone.presets` label, button role, and an accessibility state that does not imply selection.

Render the reusable sheet after `AudioToolScreen`:

```tsx
<BottomSheet
  visible={isPresetSheetVisible}
  onDismiss={() => setIsPresetSheetVisible(false)}>
  <View style={styles.presetSheet}>
    <Text variant="title" weight="bold">
      {t('audioTools.tone.presets')}
    </Text>
    <View style={styles.presetSheetGrid}>
      {PRESETS.map((preset) => (
        <ChoiceChip
          key={preset}
          label={`${new Intl.NumberFormat().format(preset)} Hz`}
          selected={frequencyHz === preset}
          haptic={hapticsEnabled}
          onPress={() => selectPreset(preset, true)}
        />
      ))}
    </View>
  </View>
</BottomSheet>
```

- [ ] **Step 6: Add approved responsive styles**

Use theme-token styles for:

- a centered intro with `md` gap;
- a mascot slot that reduces on compact heights;
- a tabular, band-colored frequency value;
- a waveform panel height between 64 and 92 points;
- a no-wrap quick preset row whose chips flex evenly and a 44-point Presets action;
- a pale surface action dock with continuous top corners, centered control, and compact safety row;
- a padded sheet with a wrapping grid of all six presets.

Do not use raw `rgba(...)`, raw colors, hard-coded shadow values, or an absolute footer.

- [ ] **Step 7: Verify static behavior**

Run: `npm run check:type`

Expected before Task 3: TypeScript passes; i18n may still report a missing synchronized key only when `npm run check:i18n` is run.

Run: `npm run lint`

Expected: PASS with no lint or formatting errors.

- [ ] **Step 8: Commit the screen composition**

```bash
git add 'src/app/(tabs)/tone-generator/index.tsx'
git commit -m "feat(tone): add focused generator layout"
```

---

### Task 3: Synchronize the concise Tone safety copy

**Files:**

- Modify: every JSON resource returned by `rg --files src/i18n/locales -g '*.json'`

**Interfaces:**

- Consumes: `t('audioTools.tone.volumeHint')` from Task 2.
- Produces: the same key in all 33 shipped locale resources.

- [ ] **Step 1: Add the safety key to every locale**

Insert this key immediately after `audioTools.tone.stop` in every locale:

```json
"volumeHint": "Keep volume low and the speaker away from your ears.",
```

Use the same English fallback text in locales whose existing Tone tool strings are still English; do not invent unreviewed translations.

- [ ] **Step 2: Verify locale synchronization**

Run: `npm run check:i18n`

Expected: PASS with all locale resources sharing the same key set.

Run: `npm run check`

Expected: PASS with lint and strict TypeScript checks succeeding.

- [ ] **Step 3: Commit localization**

```bash
git add src/i18n/locales
git commit -m "feat(tone): add safe playback hint"
```

---

### Task 4: Verify runtime behavior and visual fidelity

**Files:**

- Create: `docs/design/implementation/2026-07-21/tone-generator-idle.png`
- Create: `docs/design/implementation/2026-07-21/tone-generator-running.png`
- Create: `docs/design/implementation/2026-07-21/tone-generator-idle-comparison.png`
- Modify: `design-qa.md`

**Interfaces:**

- Consumes: the approved mockup and implemented screen from Tasks 1–3.
- Produces: accepted simulator captures, a same-input comparison, and a recorded QA result.

- [ ] **Step 1: Run the full project checks**

Run: `npm run check`

Expected: PASS.

Run: `npm run check:i18n`

Expected: PASS.

Run: `npm run test:audio`

Expected: all audio-math tests PASS, confirming frequency normalization remains unchanged.

- [ ] **Step 2: Exercise the existing iOS simulator build**

Open the Tone Generator route in the booted iPhone 17 Pro Max simulator. Verify:

- idle Play is fully above the tab bar;
- Play changes to Stop in the same dock position;
- waveform swipe and native slider update the readout;
- 165, 250, 440, and 1,000 Hz quick chips update the readout;
- Presets opens the sheet and 8,000/12,000 Hz update the live oscillator;
- Stop returns to idle and releases the session.

- [ ] **Step 3: Capture accepted idle and running states**

Save 1320 × 2868 simulator screenshots to the two implementation paths. Inspect each file and reject any capture showing loading, the wrong route, clipping, an open debug overlay, or an obscured action.

- [ ] **Step 4: Build and inspect the comparison artifact**

Normalize the approved 853 × 1844 mockup to the simulator canvas without changing aspect ratio, place it beside the idle implementation capture, and save the combined image. Inspect mascot scale, hierarchy, waveform panel, separate slider, quick presets, action dock, and tab-bar clearance.

- [ ] **Step 5: Iterate on visible mismatches**

If the comparison shows material clipping, control overlap, an oversized mascot, or a footer that consumes too much space, adjust only the relevant theme-token dimensions in the Tone screen and recapture both states. Re-run `npm run check` after any code change.

- [ ] **Step 6: Record final QA**

Append a `Tone Generator focused layout` section to `design-qa.md` with:

- source mockup and viewport;
- idle/running capture paths;
- comparison artifact path;
- behavior exercised;
- visual findings and any intentional native differences;
- screenshot-only accessibility limits;
- final `PASSED` or named blocker.

- [ ] **Step 7: Commit verified artifacts**

```bash
git add design-qa.md docs/design/implementation/2026-07-21
git commit -m "docs(tone): record focused layout qa"
```
