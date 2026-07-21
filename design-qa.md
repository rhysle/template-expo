# Eject focused layout — design QA

## Result

**PASSED** on 2026-07-21.

The idle layout matches the selected Option 1 hierarchy and the running state preserves the same focused composition without mandatory scrolling on the test viewport.

## Visual truth

- Selected source: `docs/design/references/eject-focused-option-1.png`
- Source dimensions: 853 × 1844
- Target: Eject tab, light appearance, idle state

## Implementation captures

- Idle: `docs/design/implementation/2026-07-21/eject-idle.png`
- Running: `docs/design/implementation/2026-07-21/eject-running.png`
- Simulator: iPhone 17 Pro Max, iOS 26.5
- Capture dimensions: 1320 × 2868

## Same-input comparison

- Full comparison: `docs/design/implementation/2026-07-21/eject-idle-comparison.png`
- The selected source was normalized to the 1320 × 2868 implementation canvas before being placed beside the implementation screenshot.
- A separate crop was not needed: both phone canvases remain legible at their original resolution in the combined file, including the header, hero, action, safety cue, and tab-bar clearance.

## Findings

- Hierarchy: one status, one explanatory line, one hero, one primary action, and one safety cue.
- Idle state: the mascot is the hero; no idle timer ring competes with it.
- Running state: the timer ring replaces the mascot and the primary action becomes Stop.
- Navigation clearance: the safety cue remains above the measured native tab bar.
- Overflow: idle and running states fit the tested viewport without user scrolling; the retained `ScrollView` remains available for short screens and larger accessibility text.
- Accessibility: Start and Stop are exposed as buttons; the active ring announces remaining time.
- Simulator-only artifact: the gray floating gear visible at the left edge belongs to the Simulator Tools overlay and is not rendered by the app.

## Intentional native differences

- The implementation retains the app's real status bar, native header spacing, persistent pill tab bar, existing mascot asset, theme tokens, and localized safety copy.
- These differences preserve the project's established navigation and design system while matching the selected concept's composition and emphasis.

## Iteration history

1. Removed the simultaneous idle mascot/timer stack, moved status above the subtitle, and removed the always-visible explanation card and generic notice.
2. Centered the status, removed decorative mascot waves for this screen, enlarged the primary control, and distributed the composition through the viewport.
3. Increased mascot weight and adjusted the compact breakpoint after the first side-by-side comparison showed the hero was too small.
4. Re-captured idle and running states, verified Start → running timer/Stop → idle interaction, and completed the final combined comparison.

---

# Tone Generator focused layout — design QA

## Visual truth

- Selected source: `docs/design/references/tone-generator-focused-approved.png`
- Gauge override source: `docs/design/references/tone-generator-three-wave-reference.jpg`
- Target: Tone Generator tab, light appearance, 440 Hz idle state
- User-requested refinement: keep the Play tone card in the same content parent as the upper controls instead of rendering it as a sticky footer

## Implementation evidence

- Idle: `docs/design/implementation/2026-07-21/tone-generator-idle.png`
- Running: `docs/design/implementation/2026-07-21/tone-generator-running.png`
- Full-view comparison: `docs/design/implementation/2026-07-21/tone-generator-idle-comparison.png`
- Focused gauge comparison: `docs/design/implementation/2026-07-21/tone-generator-three-wave-focused-comparison.png`
- Simulator: iPhone 17 Pro Max, iOS 26.5
- Viewport capture: 1320 × 2868, light appearance, 440 Hz
- The approved source was normalized to the implementation canvas and placed beside the rendered app in one comparison image.
- The full-view comparison keeps the typography, mascot, slider, presets, action card, safety copy, and tab-bar clearance readable. The new gauge motif was also compared in a dedicated source-versus-implementation crop because its three overlapping strokes are too fine to judge reliably in the full screen.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- Fonts and typography: the implementation preserves the app's configured type system, hierarchy, tabular frequency numerals, weights, wrapping, and localized labels. The native header and compact control labels remain legible without truncation.
- Spacing and layout rhythm: the status, subtitle, mascot, frequency block, gauge, presets, and Play tone card follow the approved vertical hierarchy. The action card is now a sibling of those sections inside `AudioToolScreen`'s content container; the separate footer wrapper has been removed.
- Colors and visual tokens: surfaces, borders, shadows, and controls use project theme tokens. The gauge uses one full-strength primary-blue path plus medium- and low-opacity supporting paths, while the 440 Hz readout retains the existing semantic low-mid band color as intentional product behavior.
- Image quality and asset fidelity: the existing whale mascot asset is sharp and correctly cropped. The Play/Stop card uses the user-supplied waveform ornament with its background removed and transparency preserved; it is not an icon approximation or code-drawn substitute. The simulator's gray floating gear at the left edge is a Simulator Tools overlay, not app UI.
- Copy and content: title, frequency status, subtitle, presets, Play/Stop label, and safety guidance are localized and complete. The safety sentence is intentionally more explicit than the abbreviated mock copy.
- Native product differences: the implementation retains the real iOS status bar, native header spacing, settings control, and app tab bar.

## Interaction and accessibility verification

- Selecting the 440 Hz quick preset updates the status, readout, waveform, slider, and selected chip.
- The Presets sheet exposes all six presets and returns the selected value to the main screen.
- The waveform exposes adjustable increment/decrement accessibility actions.
- Play changes to Stop in the same inline card position; Stop returns the screen to idle and audio was stopped after capture.
- The primary action and safety guidance remain above the native tab bar on the tested iPhone 17 Pro Max.

## Comparison history

1. The first focused implementation comparison found a P2 mascot-scale mismatch: the whale was too small and retained decorative rings. The mascot was enlarged and `showWaves={false}` was applied.
2. The revised comparison confirmed improved mascot weight and preserved the separate waveform panel and slider selected from Design 2. Remaining differences were classified as intentional native/product behavior or P3 polish.
3. After the user's inline-card refinement, the sticky footer API was removed, the Play tone card was inserted after the presets in the same content parent, and idle/running Pro Max captures were regenerated. The final comparison shows the complete card clear of the tab bar with no new P0/P1/P2 issue.
4. The latest comparison identified the line-wave gauge and missing action-card ornaments as remaining source mismatches. The gauge was rebuilt as a responsive five-cluster rounded-bar waveform in primary blue, the exact supplied ornament was placed on both sides of the primary control, and idle/running evidence was regenerated. The post-fix comparison shows both details aligned with the approved source.
5. The user selected a new three-line wave reference for the gauge. The bar clusters were replaced with three responsive sine paths using distinct frequency, phase, weight, and opacity; active playback moves the layers independently. A focused side-by-side comparison confirms the primary, secondary, and faint detail hierarchy matches the new reference while preserving the app's light panel treatment.

## Follow-up polish

- P3: the approved concept uses a slightly larger mascot. This may be revisited later if closer concept fidelity is preferred over the current product proportions.

## Final result

final result: passed
