# Product Specification

| Field          | Value                          |
| -------------- | ------------------------------ |
| Product name   | Water Eject – Speaker Cleaner  |
| Status         | In Development                 |
| Owner          | TBD                            |
| Last updated   | 2026-07-20                     |
| Target release | V1 after product configuration |

## Product Summary

### One-sentence description

Water Eject – Speaker Cleaner gives iOS and Android users four focused, on-device tools for
playing a speaker-cleaning sweep, generating tones, checking stereo channels, and estimating
nearby sound levels.

### Problem

Phone speakers can sound muffled after exposure to water or debris, and users often lack a simple
way to play a controlled cleaning frequency, diagnose channel routing, or understand their current
sound environment without using several unrelated apps.

### Desired outcome

Users can start a guided cleaning cycle in seconds, inspect speaker behavior with safe controls,
and get an understandable—but explicitly approximate—sound-level estimate without uploading or
saving microphone audio.

### Success signals

- Users start and complete a cleaning cycle without encountering an audio-session error.
- Users return to at least one audio tool in a later session.
- Microphone permission denial is recoverable and does not block the other three tools.
- Support feedback does not indicate confusion about estimated dB accuracy or audio privacy.

## Users

### Primary user

- **Who:** A phone owner troubleshooting a wet, muffled, or questionable speaker.
- **Situation:** Immediately after water exposure or when checking speaker output and balance.
- **Goal:** Improve or diagnose speaker output with clear, quick controls.
- **Current pain:** Generic videos and browser tone generators provide weak guidance, uncertain
  routing, and little safety context.

### Secondary users

People who need an occasional tone generator, stereo channel check, or approximate ambient sound
meter.

## Scope

### V1 goals

- Provide foreground-only Eject, Tone Generator, Stereo Test, and dB Meter tools.
- Make audio state, output guidance, interruptions, and recovery visible.
- Process microphone samples only in memory and clearly qualify estimated readings.
- Persist non-sensitive tool preferences and the last tone frequency.

### Non-goals

- Guaranteed water or debris removal.
- Calibrated SPL, medical assessment, or professional hearing-safety certification.
- Audio recording, sample retention, cloud analysis, or background audio/recording.
- Product-specific onboarding, finalized premium feature gates, or final store branding in this
  feature phase.

### Possible later work

- Product onboarding and education based on completed usability testing.
- Premium packaging and feature limits.
- Cleaning history, additional waveforms, device-specific calibration profiles, and hearing-dose
  tracking after privacy and accuracy review.

## Core Experience

### Primary user flow

1. The app opens on Eject and explains device position and safe playback.
2. The user starts a 30-, 60-, or 90-second cleaning cycle.
3. A countdown, animated mascot treatment, and status feedback show progress.
4. The cycle completes or stops safely on user action, navigation, backgrounding, interruption,
   or output-route loss.
5. The user tests the speaker, repeats the cycle, or opens another tab.

### First-run experience

The current template onboarding remains unchanged during feature development and is not release
content. Eject, Tone Generator, and Stereo Test require no permission. dB Meter requests microphone
access only when the user presses Start and explains that samples stay on-device.

### Navigation

| Destination    | Purpose                                        | How users reach it       |
| -------------- | ---------------------------------------------- | ------------------------ |
| Eject          | Run a guided low-frequency cleaning cycle      | Default tab              |
| Tone Generator | Play and adjust a 20–20,000 Hz sine tone       | Tone Generator tab       |
| Stereo Test    | Test left, center, right, and auto pan         | Stereo Test tab          |
| dB Meter       | Estimate current, minimum, average, and max    | dB Meter tab             |
| Settings       | Configure audio, meter, support, and legal UI  | Gear button in every tab |
| Audio Safety   | Explain playback, routing, privacy, and limits | Settings                 |

## Product Requirements

| ID     | Requirement                                                                       | Priority | Acceptance notes                                                                                               |
| ------ | --------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| PR-001 | The user can run a smooth 150–220 Hz cleaning sweep centered around 165 Hz.       | Must     | Cycle uses the configured duration, shows progress, and can be stopped immediately.                            |
| PR-002 | The user can generate a sine tone from 20–20,000 Hz.                              | Must     | Slider, waveform swipe, accessibility actions, and six presets update one live oscillator without clicks.      |
| PR-003 | The user can test stereo routing manually and automatically.                      | Must     | Manual left/center/right and an eight-second left-right-left sweep visibly match the audio pan.                |
| PR-004 | The user can start an estimated sound meter after granting microphone permission. | Must     | Meter shows current/min/average/max, four named ranges, and a persistent accuracy disclaimer.                  |
| PR-005 | Only one audio tool can own the native session at a time.                         | Must     | Starting a tool stops the previous tool; blur, background, interruption, and route loss release all resources. |
| PR-006 | Microphone samples stay on the device and are not retained.                       | Must     | Recorder file output is disabled; no samples or exact readings are logged or uploaded.                         |
| PR-007 | Audio preferences persist between launches.                                       | Should   | Cleaning duration, haptics, meter response, calibration offset, and last tone frequency restore.               |
| PR-008 | Status remains understandable without color or animation.                         | Must     | Every state has text/icon feedback and honors reduced-motion and assistive-technology behavior.                |

## States and Edge Cases

- **Loading:** The active control shows a preparing state while the OS audio session starts.
- **Error:** The tool stops, releases native resources, and shows a retryable generic audio error.
- **Offline:** All four tools remain functional; no network is required.
- **Permission denied:** Only dB Meter is unavailable. The screen explains why and links to system
  settings; playback tools remain usable.
- **Unsupported route:** Eject warns when audio is routed to headphones/Bluetooth. Stereo Test
  explains that separation depends on the current output hardware.
- **Interrupted flow:** Tab blur, navigation, app backgrounding, OS interruption, and lost output
  routes stop the session and return the UI to a recoverable state.
- **Concurrent use:** Starting another tool first stops the current native audio graph or recorder.

## Monetization

- **Business model:** Existing template subscription and ads behavior remains active during this
  phase.
- **Free experience:** No new feature gates are added; all four tools are implemented without a
  premium check.
- **Premium value:** The existing subscription suppresses ads. Additional premium value is TBD.
- **Paywall timing:** Existing automatic paywall timing remains unchanged.
- **Restore and cancellation:** Existing RevenueCat restore/subscription behavior remains.
- **Ads:** The existing anchored tab banner remains for eligible non-subscribers.

The current onboarding and broader paywall feature copy must be redesigned when premium scope is
decided; they are not approved release content.

## Data, Privacy, and Permissions

| Data or permission  | Purpose                                                            | Storage or recipient              | Retention/deletion                                                |
| ------------------- | ------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------- |
| Microphone          | Calculate an estimated nearby sound level while dB Meter is active | Processed in memory on the device | Raw buffers are discarded immediately and never written to a file |
| Audio preferences   | Restore tool choices                                               | Zustand/MMKV on device            | Removed with app data/uninstall                                   |
| Anonymous analytics | Understand tool starts/completions and permission outcomes         | Firebase Analytics                | Governed by the configured analytics policy                       |
| Error diagnostics   | Diagnose unexpected audio failures without audio content           | Sentry                            | Governed by the configured diagnostics policy                     |

- Exact microphone samples, exact dB readings, and exact custom frequencies are excluded from
  analytics and diagnostics.
- The app does not claim that estimated dB is calibrated SPL. Users may apply a ±20 dB offset by
  comparing against a trusted reference meter.
- The existing Android backup policy remains disabled until the product-level policy is reviewed.

## Analytics

| Event                          | Trigger                                   | Useful properties                               | Product question answered                   |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `audio_tool_started`           | A native audio tool reaches running state | tool, mode, configured duration when applicable | Which tools reach a usable state?           |
| `audio_tool_ended`             | A running tool releases its session       | tool, stop reason, coarse duration bucket       | Do users complete flows or get interrupted? |
| `microphone_permission_result` | dB Meter evaluates permission on Start    | granted/denied                                  | Is permission blocking meter use?           |

- **Primary funnel:** Tool screen viewed → tool started → tool ended/completed.
- **Retention signal:** Another tool start in a later app session.
- **Events intentionally excluded:** Raw samples, exact dB values, exact custom frequencies, system
  output device identifiers, and continuous gesture changes.

## Localization and Accessibility

- **Launch languages:** All locales currently declared in Expo configuration.
- **RTL behavior:** Shared automatic layout mirroring remains enabled; custom frequency gestures
  and stereo labels are reviewed in Arabic and Hebrew.
- **Dynamic text:** Screens scroll, cards flex/wrap, and critical controls remain reachable with
  larger text.
- **Screen reader behavior:** Frequency is adjustable through increment/decrement actions; meters
  expose progress values; controls and states have explicit labels.
- **Motion and haptics:** Reanimated honors reduced motion; product haptics can be disabled without
  removing visual/text feedback.
- **Color and contrast:** Meter ranges also use names, icons, guidance, and numeric values.

## Platform and Device Support

- **Platforms:** iOS and Android.
- **Form factors:** Phone-first layouts that remain responsive on supported tablets.
- **Orientation:** Portrait.
- **Required hardware:** Audio output for playback tools; microphone only for dB Meter.
- **Platform differences:** Native audio routing and microphone response vary by hardware and OS.
- **Web:** Not a V1 release target.
- **Background behavior:** All playback and recording stops immediately outside the foreground
  active tab.

## Product Configuration

- [ ] Final app name, identifiers, scheme, EAS project, and visual assets
- [ ] Product onboarding and premium/paywall content
- [x] Four product tabs and audio-tool settings
- [x] On-device microphone privacy behavior and permission copy
- [x] Product analytics event definitions
- [ ] Human review of every shipped locale
- [ ] Firebase, RevenueCat, AdMob, Sentry, support, legal, and store values for the final app
- [ ] Store metadata, screenshots, reviewer details, and device-accuracy claims

## Release Acceptance

The feature implementation is ready for product QA when:

- [ ] Audio math tests, i18n audit, lint, and strict TypeScript checks pass
- [ ] Clean Expo prebuild succeeds for iOS and Android
- [ ] All four tools are verified on physical iOS and Android devices
- [ ] Stereo direction and output-route changes are verified with headphones and device speakers
- [ ] dB Meter grant, denial, Settings recovery, and calibrated comparison are verified
- [ ] No audio remains active after navigation, backgrounding, interruption, or route loss
- [ ] Large text, VoiceOver/TalkBack, reduced motion, RTL, and color-independent states are reviewed
- [ ] Onboarding, premium packaging, branding, integrations, and store claims are finalized before
      release candidacy

## Open Questions

| Question                                                                   | Owner      | Needed by                 | Resolution                                 |
| -------------------------------------------------------------------------- | ---------- | ------------------------- | ------------------------------------------ |
| What should product onboarding teach and in what order?                    | Product    | Before release candidate  | Deferred until feature usability QA        |
| Which outcomes, if any, belong behind premium?                             | Product    | Before paywall redesign   | Deferred; no V1 implementation gates added |
| What are the final name, identifiers, legal URLs, and store metadata?      | Product    | Before distribution build | Pending                                    |
| Which physical reference devices define acceptable default meter behavior? | Product/QA | Before accuracy claims    | Pending device calibration study           |

## Change Log

| Date       | Change                                                                                         | Reason                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2026-07-20 | Defined Water Eject – Speaker Cleaner V1 feature behavior, privacy, analytics, and limitations | Replace the reusable product template with an implementation reference for the four audio tools |
