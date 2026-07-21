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
