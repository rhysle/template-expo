# DualZen phone camera MVP

DualZen uses Vision Camera 5.2.3 for camera discovery, session ownership, constraints, controls, and high-resolution photo capture. `modules/dual-recorder` provides native camera outputs, GPU crop previews, two concurrent video encoders, one microphone source, private media files, thumbnails, atomic manifests, passthrough trimming, and Photos/MediaStore export. Nitro Image performs native photo cropping and JPEG encoding; image pixels and video frames never cross the JavaScript bridge.

## Scope and defaults

Phones only; iPad support is disabled. Android requires version 10 (API 29) for scoped MediaStore export. The default profile is single rear capture at 1x using a virtual camera with an ultra-wide constituent when available, otherwise the rear wide lens; 1080p cap, 30 FPS, SDR, MP4, and standard stabilization where supported. Existing onboarding and paywall content remain intact; automatic paywalls are prevented during recording, finalization, trimming, and export. There are no new premium gates or ads.

The selected video resolution caps the output's long edge. Each output is a native 9:16 or 16:9 crop; dimensions are rounded down to exact, even pixel ratios without upscaling. A 1080p profile can therefore produce a smaller portrait or landscape crop. 2K means QHD, 2560×1440. Recording Options displays actual crop dimensions. Photos use a fixed 3024×4032 target JPEG source at 90% quality and retain the maximum pixels available to each crop.

Single-lens capture supports rear and front cameras. Dual capture is offered only for independent rear combinations reported by Vision Camera. Android dual mode cannot request capture FPS, HDR, or stabilization through Vision Camera; it uses platform capture timing, an SDR encoder profile, and no stabilization. MOV is iOS only. The iOS path supports P010/HEVC Main10/HLG and rejects an incompatible negotiated pixel format; Android HDR is disabled because its GPU path is 8-bit.

Encoder capability probes conservatively validate both full profile dimensions. Camera constraints are separately resolved and negotiated FPS substitutions prevent filming. Native encoder creation remains the final check because hardware availability can change after a capability probe.

## Camera interface

The bottom capsule contains Video, Photo, Projects, and Settings. One shared capture provider owns the active Vision Camera session, reconfiguring it when the user switches between Video and Photo so the two modes never compete for camera hardware. Photo permission requires only the camera; Video also requires the microphone.

Camera/Projects sits below the record button. A compact Framing button opens the landscape framing slider in a popover over the live preview; it stays collapsed by default and closes when a take starts. Both framing sliders, grid, project selection, actual output dimensions, and storage information remain in Recording Options. The main controls are torch, a zoom button showing the current displayable zoom and cycling through supported 0.5x/1x/2x/5x presets, preview layout, and front/back camera selection. Pinch zoom remains available on the main preview. Presets and pinch limits use the intersection of configured controllers’ displayable zoom ranges, including session restrictions; unavailable presets are skipped. Sessions start at 1x when supported.

The layout control cycles through portrait with a draggable landscape PiP, landscape above portrait, and one portrait preview with a landscape rectangle guide. The guide layout places controls over the preview to use the available height. Layout changes do not reconfigure capture or change the recorded outputs. The rectangle always has a 16:9 aspect ratio and moves with landscape framing. It is a composition reference, rather than a projection of the intersection of two differently shaped crops. Use PiP or stacked previews to inspect the actual landscape crop, including footage outside the portrait crop and independent dual-lens fields of view.

Tap a preview to show a yellow metering box. In PiP layout, focus and exposure interactions are available only on the outer portrait preview; the landscape inset keeps dragging and uses pinch to resize instead of zoom. Its width stays between 40% and 75% of the outer portrait preview, keeps a 16:9 aspect ratio, and stays within the preview bounds. Double-tap the inset to animate between its current size and the 75% maximum; the smaller size is remembered as a fraction of portrait width so it restores correctly after rotation. Pinching interrupts the toggle animation and sets a new current size. Its corners use the smaller radius token. The box and exposure control fade after three seconds of inactivity without clearing native exposure or an AE/AF lock. A new focus interaction shows the reticle again. Drag the sun thumb along its vertical rail to adjust exposure within that lens's supported range. Thumb and PiP movement run on the UI thread; native exposure requests are throttled to 40 ms with an unconditional final update. The sun has its own bounded hit target, which blocks preview gestures only for touches that start on the thumb. The fade pauses during exposure dragging and resumes on release. Hold for 650 ms to meter and lock AE/AF without automatic reset; one persistent lock indicator appears after metering succeeds. Dual-lens locks apply to both active lenses. Tap a preview or the lock indicator to return to automatic metering. Camera/session changes clear the lock. Exposure, torch, and zoom requests keep one active request and the latest pending value.

Front/back switching covers the mounted preview before changing the camera: an animated native blur and subtle scale on iOS, or a dimmed fade and scale on Android. The cover remains until the selected camera session is ready (with a short settling delay), then fades out. Setup errors also release the cover; camera and recording controls are blocked during the transition. Reduced motion follows the system setting.

## Storage and exports

Originals are stored in `Documents/DualZen/media/<media UUID>/` on iOS and the app's document/files directory on Android. Each discriminated photo or video item has portrait/landscape filenames, an atomic JSON manifest, and a thumbnail. Project manifests and an MMKV catalog persist project selection, unified media metadata, video trim ranges, and per-output export receipts. A Default Project is always available. Projects presents a newest-first combined list with All, Photos, and Videos filters.

Exports create independent Photos/Gallery assets. Deleting exported assets cannot affect originals. Auto-save to photo library defaults off and runs only after saving originals. Retries skip successful outputs for the same trim revision, or the original photo revision; “Export another copy” explicitly clears those receipts first. Per-output failures remain retryable.

One photo shutter press creates one project item containing portrait and landscape JPEG outputs. Single-lens mode captures one native photo and derives both crops. Dual-lens mode initiates one photo capture on each active rear lens and derives the matching crop from each; the pair is near-simultaneous rather than frame-synchronized. Photo mode reuses the video framing layouts, grid, lens selection, focus, exposure, zoom, and project selection. Its flash control cycles Off, Auto, and On for a supported single rear camera and remains off for front or dual-lens capture.

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

### Camera interface update verification

The camera interface changes use existing VisionCamera native controls and do not require prebuild. The simulator shows the moved bottom selector and simplified controls; it has no camera, so it cannot verify preview rendering or hardware gestures. On iOS and Android phones check all three layouts, PiP dragging, pinch resizing at the 40%/75% limits, double-tap expand/restore before and after rotation, zoom preset cycling and the live pinch zoom label, front/back transitions including setup failures, tap focus at preview edges, continuous sun movement along the vertical exposure rail and fade after inactivity, hold-to-lock followed by additional captures, tap-to-unlock, and smooth supported zoom preset transitions while idle and recording. Check focus/exposure behavior in single and supported dual-lens modes, mirrored selfie previews, and both device orientations.

### Remaining physical-phone verification

Physical-phone verification is required before considering this recording pipeline release ready. The iPhone 15 Pro Max runs iOS 27; no Android phone is connected. Simulator compilation and APK builds cannot verify simultaneous hardware encoder capacity, framing/rotation/mirroring, audio synchronization, thermal behavior, camera interruptions, or HDR preservation across different phones.

On both phones verify rear/selfie capture in portrait and both landscape orientations; crop previews against saved files; zoom/focus/exposure/torch while filming; stabilization; output dimensions/FPS/color metadata; and perceptual audio sync on short and 20-minute recordings. Recheck recording start/end after installing the final iOS timing refinements. Check supported and unsupported lens pairs/profiles, low-storage stopping, thermal stopping, background/interruption handling, permission denial, and partial encoder/export failures. Verify photo capture with microphone permission denied, single/dual-lens photo crops, flash states, JPEG orientation and mirroring, project persistence after relaunch, media filtering, project creation/renaming/deletion, moving/deleting media, synchronized video trims, successful-output export skipping, explicit duplicate exports, auto-save, and independence from Photos/Gallery deletion.

Pause/resume, segmentation, crash recovery, retained uncropped sources, later reframing, and precise frame cuts remain deferred. Abrupt process termination can lose the active take. App uninstall removes private originals. Dual encoding adds hardware load; device testing must establish practical resolution/FPS limits and heat behavior.
