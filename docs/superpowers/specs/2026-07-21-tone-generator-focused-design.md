# Tone Generator Focused Screen Design

Date: 2026-07-21
Status: Approved visual direction; awaiting written-spec review

## Goal

Recompose the Tone Generator tab as a focused, mascot-led instrument where a user can identify the current frequency band, adjust the frequency, choose a preset, start playback, and stop playback without the primary action colliding with the bottom tab bar.

The redesign must preserve the existing audio behavior, saved frequency, accessibility actions, error handling, localization, and reduced-motion support.

## Visual source of truth

- Approved mockup: `docs/design/references/tone-generator-focused-approved.png`
- Product inspiration: `docs/design/references/tone-generator.png`
- Current-state audit: `docs/design/audit/2026-07-21/tone-generator-audit.md`

The approved mockup combines the overall hierarchy of the third generated direction with the waveform-panel and separate-slider treatment from the second direction. The implementation should use the app's real mascot asset, native header, theme tokens, navigation, and localized content rather than reproducing generated assets or device chrome.

## Experience structure

The screen is ordered as follows:

1. A compact frequency-band badge.
2. The existing one-sentence Tone Generator explanation.
3. The existing whale mascot as a medium-sized hero.
4. A `Current frequency` label and large tabular frequency value with `Hz` aligned to its baseline.
5. A shallow pale-blue waveform panel.
6. A separate logarithmic native slider with `20 Hz` and `20,000 Hz` endpoints.
7. A compact quick-preset row for 165, 250, 440, and 1,000 Hz plus a `Presets` action.
8. A persistent action dock above the tab bar containing the circular Play/Stop control, its text label, and a concise low-volume safety cue.

The mascot remains part of the Tone identity. It is smaller than the current implementation so it supports the frequency instrument rather than displacing it.

## Layout and responsiveness

`AudioToolScreen` gains an optional footer slot for focused tools. When supplied, the scrollable instrument content occupies the remaining height and the footer stays in normal layout flow directly above the reserved tab-bar area. The footer never overlays scroll content.

Tone Generator uses the focused screen variant and supplies the action dock through this footer slot. Eject remains unchanged because it does not provide a footer.

Two visual densities are required:

- At 900 points or taller, use the medium mascot treatment, standard focused spacing, a 72–92 point waveform, and the current default circular control size.
- Below 900 points, reduce vertical gaps, use a smaller mascot slot, use a 64–72 point waveform, and keep the safety cue to a compact line. The instrument area may scroll as a fallback, but the action dock remains visible.

Large Dynamic Type may make the instrument scroll. Text must reflow without clipping, and the persistent dock must remain operable without covering content.

## Frequency controls

The current logarithmic mapping from 20–20,000 Hz remains unchanged.

- Swiping horizontally on the waveform updates the frequency.
- The native slider updates the same normalized frequency value.
- Accessibility increment and decrement actions adjust by the existing 10% multiplier.
- While the tone is running, every frequency change updates the live oscillator without restarting it.
- The selected frequency continues to persist after the existing debounce.

The waveform panel retains band-based color and active animation. With reduced motion enabled, it remains a static waveform and communicates state through text and control state.

## Presets

The quick row contains 165, 250, 440, and 1,000 Hz. The adjacent `Presets` action opens the existing reusable bottom-sheet pattern with all six presets: 165, 250, 440, 1,000, 8,000, and 12,000 Hz.

Selecting any preset:

- updates the frequency readout, waveform, and slider;
- updates the live oscillator when playback is active;
- closes the sheet;
- preserves selection haptics when enabled.

When 8,000 or 12,000 Hz is selected, no quick chip is selected; the large readout and band badge remain the authoritative visible state. The full sheet marks the selected preset.

## Playback states

The action dock occupies the same position in every state.

- Idle: blue Play control and `Play tone` label.
- Starting: disabled control with a loading indicator.
- Running: red Stop control and `Stop tone` label; the mascot and waveform may animate subject to reduced-motion settings.
- Stopping: disabled Stop control with a loading indicator.
- Error: return to the idle control and show the existing localized error notice in the scrollable instrument area.

The dock also shows a concise localized safety cue instructing the user to keep volume low and the speaker away from their ears. This replaces the long always-visible generic notice on this screen only.

## Components and boundaries

- `AudioToolScreen`: owns the optional focused footer layout and tab-bar clearance. It does not know Tone Generator behavior.
- `ToneGeneratorScreen`: owns frequency state, presets-sheet visibility, controller calls, state-derived labels, and composition.
- `FrequencyWaveform`: remains the adjustable visual control; only its screen-level size may change.
- `MascotHero`: uses the existing asset and public sizing options. Add a new size only if the approved hierarchy cannot be achieved with the current compact variant.
- `CircularAudioButton`: retains the existing Play/Stop/loading behavior and accessibility contract.
- Existing `BottomSheet` and `ChoiceChip` components provide the full preset picker.

No audio-service, persistence, routing, navigation, analytics, or native-project changes are required.

## Accessibility

- Play and Stop remain labeled buttons with busy and disabled state exposed during transitions.
- The waveform remains an adjustable control with value text and increment/decrement actions.
- The native slider remains operable independently of the waveform.
- Preset chips expose selected state; the full preset sheet has a visible heading and dismisses through standard modal behavior.
- Frequency band, numeric value, and Play/Stop text ensure state does not rely on color or animation.
- All interactive targets remain at least 44 points.
- Reduced motion disables continuous mascot and waveform motion.
- VoiceOver verification must confirm that focus remains on the control when Play changes to Stop and that opening/closing Presets moves and restores focus sensibly.

## Localization

Reuse existing Tone Generator, band, frequency, preset, Play/Stop, range, and error strings. Add only the concise Tone-specific safety cue and keep the key synchronized across every shipped locale.

The layout must tolerate longer translated titles, band names, preset labels, and safety copy. RTL order follows React Native direction handling; the frequency number and `Hz` remain a readable unit pair.

## Verification and acceptance

Code quality:

- `npm run check` passes.
- `npm run check:i18n` passes after the safety copy is added.

Runtime behavior on the existing iOS simulator:

- Idle, starting, running, stopping, and error-recovery compositions preserve the existing controller behavior.
- Waveform swipe, slider movement, quick presets, and sheet presets all update one live frequency.
- Play and Stop remain fully visible and tappable above the native tab bar.
- The preset sheet selects all six values and closes correctly.

Visual QA:

- Capture idle and running states at the same simulator viewport.
- Compare the idle capture and approved mockup side by side at matched canvas size.
- Check hierarchy, mascot scale, waveform/slider separation, dock position, tab-bar clearance, truncation, and unexpected scrolling.
- Check one compact-height viewport or simulator size.
- Record screenshot-only accessibility limits and separately verify VoiceOver focus, Dynamic Type reflow, and reduced motion.

## Out of scope

- New tone types, waveform shapes, favorites, history, direct numeric entry, volume control, or background playback.
- Changes to oscillator math, audio session ownership, persistence format, analytics, tabs, settings, or the other audio tools.
- New mascot artwork or generated production assets.
