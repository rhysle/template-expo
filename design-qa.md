# Eject tab design QA

## Evidence

- Source visual truth: `/Users/tailt/.codex/generated_images/019f88bf-cf8e-7251-b525-8f07fbb4a85c/exec-fb048441-94d1-46b8-82de-0519a8a1c643.png`
- Implementation capture: `/Users/tailt/Development/Projects/template-expo/.codex/qa/eject-active-revised.png`
- Full normalized comparison: `/Users/tailt/Development/Projects/template-expo/.codex/qa/eject-comparison.png`
- Focused control comparison: `/Users/tailt/Development/Projects/template-expo/.codex/qa/eject-controls-comparison.png`
- Source dimensions: 853 × 1844 px
- Implementation dimensions: 1320 × 2868 px from an iPhone 17 Pro Max simulator at 3× density (440 × 956 pt)
- Comparison normalization: both images resized to 660 × 1434 px; aspect-ratio drift is under 0.6%.
- State tested: active 60-second cleaning session.

## Approved overrides

The implementation intentionally supersedes two details in the source concept based on the user's later direction:

- Unselected durations are borderless and the outer duration container is fully rounded.
- The active `Stop cleaning` label is red to match the stop button and progress ring.

The source concept's small `Duration` lock label was omitted because the selected state is preserved while the entire control is disabled during playback, giving the same interaction constraint with less visual noise.

## Comparison findings

| Surface | Result | Notes |
| --- | --- | --- |
| Typography | Pass | Timer uses tabular numerals with strong blue hierarchy; stop label uses the semantic error tone. |
| Spacing and layout | Pass | Mascot remains visible; timer, stop control, duration pill, guidance, and tab bar all clear one another at the tested viewport. |
| Colors and tokens | Pass | Primary blue, semantic red, subtle pill surface, and secondary text all use project theme tokens. |
| Image fidelity | Pass | Existing mascot artwork remains sharp, centered, and uncropped in the active state. |
| Copy and content | Pass | Remaining time and guidance remain localized; the background-interruption notice is absent. |
| Interaction | Pass | The selected duration is a filled circle; unselected values are borderless; duration changes are disabled while cleaning. |
| Accessibility | Pass | Duration group exposes radio roles and selected/disabled state; the countdown exposes a timer role and value. |

## Iteration history

1. Initial active-state capture found two P2 issues: the guidance text collided with the tab-bar region, and the selected duration became too faint when disabled.
2. Reduced the compact active hero/control heights and mascot scale, then kept the disabled selected circle at full opacity.
3. Revised capture confirmed the guidance clears the tab bar and all duration states remain legible.
4. Final user feedback changed `Stop cleaning` from accent blue to semantic red; the revised capture confirms it matches the stop control.

## Remaining issues

No P0, P1, or P2 visual issues remain in the tested active state.

final result: passed
