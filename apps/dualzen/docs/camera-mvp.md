# DualZen phone camera MVP

DualZen uses Vision Camera 5.2.3 for camera discovery, session ownership, constraints, and controls. `modules/dual-recorder` provides native camera outputs, GPU crop previews, two concurrent encoders, one microphone source, private recording files, thumbnails, atomic manifests, passthrough trimming, and Photos/MediaStore export. Frames never cross the JavaScript bridge.

## Scope and defaults

Phones only; iPad support is disabled. Android requires version 10 (API 29) for scoped MediaStore export. The default profile is single rear wide lens, 1080p cap, 30 FPS, SDR, MP4, and standard stabilization where supported. Existing onboarding and paywall content remain intact; automatic paywalls are prevented during recording, finalization, trimming, and export. There are no new premium gates or ads.

The selected resolution caps the output's long edge. Each output is a native 9:16 or 16:9 crop; dimensions are rounded down to exact, even pixel ratios without upscaling. A 1080p profile can therefore produce a smaller portrait or landscape crop. 2K means QHD, 2560×1440. The camera screen displays actual crop dimensions.

Single-lens capture supports rear and front cameras. Dual capture is offered only for independent rear combinations reported by Vision Camera. Android dual mode cannot request capture FPS, HDR, or stabilization through Vision Camera; it uses platform capture timing, an SDR encoder profile, and no stabilization. MOV is iOS only. The iOS path supports P010/HEVC Main10/HLG and rejects an incompatible negotiated pixel format; Android HDR is disabled because its GPU path is 8-bit.

Encoder capability probes conservatively validate both full profile dimensions. Camera constraints are separately resolved and negotiated FPS substitutions prevent filming. Native encoder creation remains the final check because hardware availability can change after a capability probe.

## Storage and exports

Originals are stored in `Documents/DualZen/takes/<take UUID>/` on iOS and the app's document/files directory on Android. Each take has portrait/landscape filenames, an atomic JSON manifest, and a thumbnail. Project manifests and an MMKV catalog persist project selection, take metadata, shared trim ranges, and per-output export receipts. A Default Project is always available.

Exports create independent Photos/Gallery assets. Deleting exported assets cannot affect originals. Auto-export defaults off and runs only after saving originals. Retries skip successful outputs for the same trim revision; “Export another copy” explicitly clears those receipts first. Per-output failures remain retryable.

Trims snap to actual shared video keyframes. Both encoders use a two-second keyframe interval; Android also requests simultaneous sync frames. The UI displays adjusted cut times and rejects unavailable shared ranges. iOS uses AVAssetExportSession passthrough; Android remuxes compressed samples with MediaExtractor/MediaMuxer. Full exports copy the existing encoded files. No FFmpeg or re-encoding package is used.

iOS waits for microphone samples before opening the shared video timeline, retaining at most one startup audio buffer. AVAssetWriter clips that buffer to the video start and both writing sessions end at the final video frame boundary. Capture timestamps remain unchanged. Empty AVAssetReader boundary markers are excluded from recorded keyframes.

Recording actions are serialized. The phone remains awake during recording and finalization. Orientation is locked to the starting phone orientation and restored afterward. Native storage monitoring reserves at least 256 MiB, or 15 seconds of estimated output, before stopping. Estimates include both video streams, two AAC tracks, muxing overhead, and the reserve. Critical thermal conditions and interruptions finalize the active take. Successfully finalized outputs remain visible if their partner fails.

## Installed dependencies

- `react-native-vision-camera@5.2.3`
- `react-native-nitro-image@0.15.2`
- `expo-file-system@~57.0.7`
- `expo-video@~57.0.4`
- `expo-keep-awake@~57.0.2`
- `expo-screen-orientation@~57.0.2`
- Development binding generator: `nitrogen@0.37.0`
- Existing `react-native-nitro-modules` aligned to `0.37.0` in all workspace apps.

The local Expo module was scaffolded before adding Nitro bindings. Generated bindings are committed under `modules/dual-recorder/nitrogen/generated`. Regenerate from the module directory with `pnpm exec nitrogen` after changing `src/DualOutputFactory.nitro.ts`. The two iOS podspecs live at the module root so CocoaPods includes the generated sources. The Expo interface uses an Objective-C boundary to the Nitro engine, keeping Expo classes out of Swift/C++ generated headers and allowing Expo's default precompiled modules. Generated app-level `ios/` and `android/` projects are not source files and must not be edited directly. EAS ignore rules preserve local module sources and generated bindings while excluding app-level native projects and native build products.

## Verification

Run root `pnpm check`, app `pnpm check:i18n`, app `pnpm doctor`, Expo config inspection, isolated `pnpm eas-build:inspect`, clean prebuild after dependency/configuration changes, and native app builds. No automated test suite is added.

### Completed checks — September 18, 2026

- Root `pnpm check`: workspace ESLint and TypeScript passed.
- App `pnpm check:i18n`: English source audit passed.
- App `pnpm doctor`: 21/21 checks passed with network access.
- Production Expo configuration: dark appearance, phone orientation support, camera/microphone/Photos add-only descriptions, and `ios.supportsTablet: false`. The generated iOS target uses device family 1.
- Isolated EAS archive: both local podspecs, recorder Swift/Kotlin sources, bridge, and generated Nitro bindings included; generated app-level iOS/Android projects excluded.
- Native builds: signed iPhone, iPhone simulator, and Android debug APK succeeded. The final iOS timing and keyframe refinements require a new native installation.
- The user confirmed the previously reported startup, blank preview, resolution selector, and recording-stop issues were fixed on their physical iPhone. Live crop previews were also inspected in a device screenshot.
- Inspection of a subsequent saved HDR take on the iPhone found both originals, a durable manifest, a thumbnail, and successful independent Photos export receipts for both outputs. Its manifest contained no recording error and both outputs were marked ready.
- Both files contain HEVC Main10, 10-bit YUV, BT.2020 primaries/matrix, HLG transfer, AAC audio, and matching 30 FPS timelines. Actual dimensions were portrait 1080×1920 and landscape 1440×810, without upscaling.
- Manual AVFoundation inspection of those copied files confirmed real shared keyframes at 0, 2, and 4 seconds. Four empty reader markers per file were excluded by the new filter. Passthrough trims from 2 to 4 seconds produced matching two-second audio/video tracks and retained each output's dimensions and 10-bit HLG metadata. This inspection ran on macOS against copies; phone trim verification remains below.

### Remaining physical-phone verification

Physical-phone verification is required before considering this recording pipeline release ready. The iPhone 15 Pro Max runs iOS 27; no Android phone is connected. Simulator compilation and APK builds cannot verify simultaneous hardware encoder capacity, framing/rotation/mirroring, audio synchronization, thermal behavior, camera interruptions, or HDR preservation across different phones.

On both phones verify rear/selfie capture in portrait and both landscape orientations; crop previews against saved files; zoom/focus/exposure/torch while filming; stabilization; output dimensions/FPS/color metadata; and perceptual audio sync on short and 20-minute recordings. Recheck recording start/end after installing the final iOS timing refinements. Check supported and unsupported lens pairs/profiles, low-storage stopping, thermal stopping, background/interruption handling, permission denial, and partial encoder/export failures. Verify project persistence after relaunch, project creation/renaming/deletion, moving/deleting takes, synchronized trims on phones, successful-output export skipping, explicit duplicate exports, auto-export, and independence from Photos/Gallery deletion.

Pause/resume, segmentation, crash recovery, retained uncropped sources, later reframing, and precise frame cuts remain deferred. Abrupt process termination can lose the active take. App uninstall removes private originals. Dual encoding adds hardware load; device testing must establish practical resolution/FPS limits and heat behavior.
