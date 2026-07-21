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

# Tone Generator overlay layout — design QA

## Visual truth

- Final selected source: `docs/design/references/tone-generator-overlay-final.png`
- Supporting wave reference: `docs/design/references/tone-generator-three-wave-reference.jpg`
- Target: Tone Generator tab, light appearance, 440 Hz idle state
- Required refinements: no waveform panel background, no Play tone section background, a larger mascot, and the frequency readout layered over the three-wave gauge with a softer adjustable center treatment.

## Implementation evidence

- Idle: `docs/design/implementation/2026-07-21/tone-generator-idle.png`
- Running: `docs/design/implementation/2026-07-21/tone-generator-running.png`
- Full-view comparison: `docs/design/implementation/2026-07-21/tone-generator-overlay-final-comparison.png`
- Focused gauge comparison: `docs/design/implementation/2026-07-21/tone-generator-overlay-gauge-comparison.png`
- Simulator: the existing iPhone 17 Pro Max instance, iOS 26.5
- Viewport: 1320 × 2868, light appearance, 440 Hz
- The source was normalized to the implementation canvas and placed beside the rendered screen. A separate semantic crop compares the layered readout and fine wave treatment at readable scale.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- Fonts and typography: the app's configured family, hierarchy, weights, line heights, wrapping, and tabular frequency numerals are preserved. The layered value and Hz unit remain readable over all three paths and no control label truncates.
- Spacing and layout rhythm: merging the readout into the gauge reclaims vertical space for the larger mascot. The slider, presets, floating Play controls, safety cue, and native tab bar retain clear separation. Both requested section backgrounds, their radii, and the Play section shadow are absent.
- Colors and visual tokens: the background-free gauge uses the theme's primary blue at three weights/opacities. The readout retains its semantic frequency-band color. The center veil derives from `background.base`, so it feathers into the page without introducing a colored panel.
- Image quality and asset fidelity: the whale is the existing sharp product asset and now carries the intended hero weight. The two Play ornaments use the supplied transparent raster asset rather than an approximation. The gray left-edge gear is a Simulator Tools overlay and is not app UI.
- Copy and content: title, status, subtitle, presets, Play/Stop label, and safety guidance remain complete and localized. “Current frequency” is retained in the adjustable control's accessible label while the visual label is omitted to match the selected compact composition.
- Intentional native differences: the implementation retains the real Dynamic Island/status bar, native header spacing, settings control, product tab bar, and the existing primary control sizing.

## Interaction and accessibility verification

- Selecting 440 Hz updates the readout, waveform, slider, and selected chip.
- The waveform remains an adjustable accessibility control with increment/decrement actions and announces the current value.
- Play changes to Stop, the three wave layers animate, and Stop returns to idle; audio was stopped after the final capture.
- The safety cue and primary action remain fully visible above the native tab bar.
- No render error remained after the final same-device refresh.

## Comparison history

1. Earlier approved passes established the focused hierarchy, inline Play section, supplied ornaments, and animated three-wave gauge.
2. The first overlay pass removed both backgrounds and merged the readout with the gauge, but the combined comparison found two P2 mismatches: the mascot remained materially smaller than the final source and the primary wave was too visually busy behind the digits.
3. The mascot switched from the compact frame to the full Pro Max treatment and the center feather was widened and strengthened while keeping blur itself at the softer `0.3` default. The post-fix full and focused comparisons show the intended hero proportion and a legible layered readout without restoring a panel background.
4. Idle and running states were re-captured on the existing iPhone 17 Pro Max, and Play → Stop → Play was verified after the visual fixes.

## Follow-up polish

- P3: the generated source uses a slightly finer, more symmetrical center taper. The implementation intentionally keeps the live paths responsive to frequency and animation, so their exact crossing points vary.

## Final result

final result: passed
