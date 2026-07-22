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

---

# dB Meter revamp and guide — design QA

## Visual truth and implementation evidence

- Main-screen source: `/Users/tailt/.codex/generated_images/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/exec-fbe7e8e7-18da-466d-8699-6aae6359d0ed.png`
- Guide source: `/Users/tailt/.codex/generated_images/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/exec-31e6b593-f8cd-4501-a75f-bf13e46caf14.png`
- Active implementation: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/db-meter-active-final-v3.png`
- Initial 0 dB implementation: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/db-meter-initial-final-2.png`
- Guide top: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/db-meter-help-top-final.png`
- Guide lower content and Done action: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/db-meter-help-top-v2.png`
- Main same-input comparison: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/db-meter-active-comparison-v3.png`
- Guide top same-input comparison: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/db-meter-help-comparison-final.png`
- Guide lower same-input comparison: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/db-meter-help-lower-comparison-final.png`
- Sticky guide implementation: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/help-sticky-final.png`
- Sticky guide same-input comparison: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/help-sticky-comparison.png`
- Matched-surface follow-up: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/help-surface-match-final.png`
- Reported/fixed surface comparison: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/help-surface-match-comparison.png`
- Borderless blur and category follow-up: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/help-blur-category-final.png`
- Reported/fixed blur-category comparison: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/help-blur-category-comparison.png`
- Reading alignment follow-up: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/meter-reading-alignment-final.png`
- Reading alignment reported/fixed comparison: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/meter-reading-alignment-comparison.png`
- Header fade and live-unit follow-up: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/help-header-fade-unit-final.png`
- Header fade and live-unit reported/fixed comparison: `/Users/tailt/.codex/visualizations/2026/07/22/019f8800-83cd-7eb3-bd67-3c3c6f686ea3/db-meter/help-header-fade-unit-comparison.png`

## Viewport, state, and normalization

- Device: iPhone 17 Pro Max simulator, iOS 26.5, light appearance.
- Implementation capture: 1320 × 2868 pixels at 3× density, corresponding to a 440 × 956-point app viewport.
- Main source: 853 × 1844 pixels. Guide source: 854 × 1842 pixels. Source density metadata is unavailable, so each implementation capture was resized to the matching source pixel canvas before the source and implementation were joined side by side. The aspect-ratio difference is under 0.6%.
- Main comparison state: running meter in the Normal band. The source uses illustrative 58/26/51/92 dB values; the implementation uses live simulator readings, so values differ while state styling and per-value band colors remain the comparison target.
- Additional state: the cold-start 0 dB capture verifies the requested green gradient-endpoint color for both the primary reading and gauge thumb. Start and Stop states were both exercised.
- Guide comparison state: a captured 45 dB current estimate, with both the top of the sheet and the scrolled lower sections captured.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- Fonts and typography: the implementation uses the app's configured font family, tabular numerals, existing 48-point reading size, and established text hierarchy. The native guide deliberately uses the app's readable body sizes rather than compressing all sections into one viewport; scrolling was explicitly accepted.
- Spacing and layout rhythm: the mascot is the dominant hero, the reading/status/gauge are one clear group, stats use only vertical dividers, and the action remains clear of the persistent tab bar. The sheet preserves section separation and scroll reachability without an artificial bottom information block.
- Colors and visual tokens: the live reading, gauge thumb, status, and each stat map to semantic band colors. The idle 0 dB exception maps to the green color at the gauge's zero endpoint. Start remains primary blue and Stop uses semantic red, including matching label color.
- Image quality and asset fidelity: the screen uses the existing sharp product mascot asset at a larger scale. No placeholder art or replacement illustration was introduced.
- Icons: Help, Settings, measurement status, microphone, location, and hearing-protection icons use the project's Phosphor icon family and retain accessible labels or adjacent text.
- Copy and content: the guide includes all three measurement steps, the full everyday-sound scale, the NIOSH exposure table, and all three usage tips. Per the final user direction, it has no X button and no “About this estimate” or “Privacy” sections.
- Accessibility and behavior: Help opens as a native bottom sheet, nested scrolling reaches the lower content and Done action, Done dismisses the sheet, and Start/Stop expose correct button labels. Conditional permission and error notices remain available on the meter screen.
- Simulator-only artifact: the translucent floating gear at the left edge belongs to the Simulator Tools overlay and is not rendered by app code.

## Comparison history

1. First guide comparison found a P2 collision when the live estimate sat close to a fixed reference value, and the sheet sat lower than the selected composition. The chart was changed to insert the live estimate as its own ordered row, nearby duplicates are suppressed, and the sheet detent increased from 92% to 96%.
2. Post-fix guide captures show the current estimate has a full non-overlapping highlighted row, the reference scale remains legible, and the scrolled view contains Exposure time matters, Use it well, and only the Done action below them.
3. First main-screen comparison found P2 proportion drift: the mascot was too small and the meter/action rhythm did not match the approved hero emphasis. The mascot scale increased, the reading group moved closer to it, and explicit spacing was added before stats and controls.
4. The final full-view comparison shows the intended hierarchy, semantic colors, borderless stats, larger mascot, and active red Stop state with no clipped or unreachable app controls.
5. The modal follow-up keeps the title and Done action in fixed overlay chrome. The title uses the same `systemChromeMaterial` blur material as Settings, while a transparent-to-surface gradient above the footer progressively obscures the last reference row before it passes under the fixed action. Overlay hit testing is restricted to the button, leaving the fade and title regions available to the underlying scroll gesture.
6. The reported/fixed comparison identified the system material tint as visibly different from the modal surface. Both fixed regions now use the exact sheet surface token, and the footer's top padding and separator were removed so the fade terminates directly at the Done container without a contrasting strip.
7. The next reported/fixed comparison found that an opaque matching header had lost its scroll-under blur and that “Current estimate” displaced useful classification context. The header now uses a theme-adaptive light/dark BlurView over a translucent sheet-surface tint, is rendered after the ScrollView as required by Expo, and has no bottom border. The live row now stacks its semantic meter category above “Current estimate” and follows that category's color, so a 46 dB reading reads “Normal / Current estimate” without removing either meaning.
8. The final follow-up replaces that header blur with a 32-point surface-to-transparent fade, matching the footer's visual language without the material distortion. A symmetric invisible unit spacer keeps the numeric reading itself centered over the status badge while preserving the visible trailing dB unit. The nested dB unit in the live guide row now explicitly inherits the category color; reference-row units remain standard text color.

## Open questions

- None. Native status-bar/header height and the iOS shared header-action capsule are expected platform differences from the generated concept.

## Follow-up polish

- P3: on devices with substantially shorter viewports, the retained screen ScrollView may require a small vertical scroll; content and controls remain reachable.

final result: passed

---

# Stereo Test design QA

## Evidence

- Reference: `/Users/tailt/.codex/generated_images/019f8531-6f7f-7620-bada-d2e7164acaa2/exec-b23808dc-5f48-44fc-ae56-c75da44e0f56.png`
- Idle implementation: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-test-implementation-idle.png`
- Active implementation: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-test-implementation-active.png`
- Side-by-side comparison: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-test-comparison.png`
- Native help sheet: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-test-help-sheet.png`

The reference and implementation were compared at the same 852 × 1846 aspect-ratio viewport. The implementation screenshot uses the left-channel state while the reference uses the mirrored right-channel state.

## Visual checks

- Header title and Help/Settings action order match the approved direction.
- Two large, independent vector speaker controls replace the segmented control, mascot, and slider.
- Active and inactive speaker hierarchy is clear through color, outline, driver treatment, animated level bars, and expanding pulse rings.
- Auto alternate appears above the transport as a native toggle.
- Start/Stop uses the shared circular audio control and a red active state.
- Bottom navigation remains unchanged and all content clears the tab bar.
- Typography, spacing, radii, and colors use the existing theme system.
- Native help sheet has readable hierarchy, four concise instructions, drag-to-dismiss behavior, and a clear Done action.
- No clipped copy, overlapping app controls, or unreachable actions were observed on iPhone 17 Pro Max. The translucent gear on the left edge is a development-only tool overlay and is not part of the product UI.

## Interaction checks

- Left speaker starts the left channel immediately.
- Right speaker can be added for both-channel playback.
- Deselecting the final playing speaker stops playback.
- Auto alternate cycles left → right → both.
- Stop ends playback and clears the active speaker state.
- Help opens and dismisses through the native bottom sheet.

final result: passed

---

# Stereo Test header and help-sheet follow-up — design QA

## Reported evidence

- Merged header controls: `/Users/tailt/.codex/attachments/41e8235f-29f5-4ad6-8a1b-afd02451c63f/image-1.png`
- Excess help-sheet bottom space: `/Users/tailt/.codex/attachments/41e8235f-29f5-4ad6-8a1b-afd02451c63f/image-2.png`
- Fixed header: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-header-separated.png`
- Fixed help sheet: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-help-sheet-refined.png`
- Combined reported/fixed comparison: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-fixes-comparison.png`

## Findings and fixes

- The custom iOS header row was composited as one shared Liquid Glass item. The iOS header now uses two native toolbar buttons with background sharing disabled, so Help and Settings retain separate circular hit targets and glass treatments. Android keeps the existing custom header fallback.
- The dynamic native sheet content was missing the library's fit-to-content wrapper and also added a second safe-area bottom offset inside an already safe-area-aware presentation. The sheet now uses `BottomSheetView` and removes the duplicate content inset.
- The final comparison shows the two header buttons remain visually independent and the sheet ends after the Done action with only the native bottom clearance.

## Interaction verification

- Help opens the native sheet and Done dismisses it.
- Settings navigates to the Settings route from its independent header button.
- Both controls expose distinct accessibility labels and hit targets.
- Verified on iPhone 17 Pro Max, iOS 26.5.

final result: passed

---

# Stereo Test settings-icon consistency follow-up — design QA

## Evidence

- Tone Generator reference: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/tone-settings-icon-reference.png`
- Stereo Test fixed: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-settings-icon-fixed.png`
- Header comparison: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-settings-icon-consistency.png`

## Findings and fix

- The regression came from replacing the shared 24-point Phosphor Gear with the heavier, system-sized `gearshape` SF Symbol when the header actions were separated.
- Stereo now uses a template image generated directly from the same Phosphor Gear regular-weight vector used by `SettingsHeaderButton`, while retaining the native toolbar button wrapper and `sharesBackground: false` behavior.
- The final comparison confirms matching outline, tooth geometry, stroke weight, and optical size across Tone Generator and Stereo Test.
- Settings navigation and the Help sheet were both re-tested after the icon replacement.

final result: passed

---

# Stereo Test default header grouping and padding — design QA

This pass supersedes the two header-separation follow-ups above. The help-sheet sizing fix remains valid and unchanged.

## Evidence and normalization

- Source visual truth: `/var/folders/22/z30dj1kx0wqcx8gdrgfvtm_r0000gn/T/codex-clipboard-58430227-1b81-4365-93f2-24a0cebad5c4.png`
- Implementation: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-default-group-padding.png`
- Full-view and focused-header comparison: `/Users/tailt/.codex/visualizations/2026/07/21/019f8531-6f7f-7620-bada-d2e7164acaa2/stereo-default-group-padding-comparison.png`
- Device and state: iPhone 17 Pro Max, iOS 26.5, light appearance, idle Stereo Test.
- Source pixels: 945 × 2048. Implementation pixels: 1320 × 2868. The implementation was normalized to the source width for the full view; the focused header crops used proportional 945 × 460 and 1320 × 642 regions before both were normalized to 460 × 224.

## Findings and resolution

- P2 found in the source: the shared Liquid Glass capsule wrapped the 24-point Help and Settings icons plus their 16-point gap with almost no explicit horizontal inset.
- Fix: restored the default shared iOS capsule and added 8 points of horizontal padding on each side of the icon row.
- The forced `unstable_headerRightItems` path, `sharesBackground: false` overrides, and generated settings-icon assets were removed. The header again uses the existing Phosphor controls and the base `TabStack` API remains generic.
- Post-fix evidence shows a balanced capsule with clear side breathing room while preserving icon size, gap, alignment, header edge margin, and independent tap targets.

## Required fidelity surfaces

- Fonts and typography: unchanged; the header title and supporting text retain the configured family, weights, size, and wrapping.
- Spacing and layout rhythm: the only visible change is the requested 8-point capsule side inset; screen composition and vertical rhythm are unchanged.
- Colors and visual tokens: unchanged; the new inset uses the existing `spacing.sm` token and the system continues to own the Liquid Glass surface.
- Image quality and asset fidelity: the generated gear raster assets were removed; both header icons again come directly from the existing Phosphor icon library.
- Copy and content: unchanged.

## Interaction verification

- Help opens the native guide sheet and Done dismisses it.
- Settings navigates to the Settings screen.
- The two controls remain independently pressable inside the shared visual group.

## Comparison history

1. The source capture established the P2 side-padding issue in the default merged capsule.
2. The forced separation and custom icon workaround were removed.
3. The 8-point horizontal inset was added, the screen was re-captured, and the combined comparison showed no remaining P0, P1, or P2 mismatch.

final result: passed
