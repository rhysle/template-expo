import { useSnackbarState } from '@shared/core/stores/features/snackbar'
import { File } from 'expo-file-system'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, Platform } from 'react-native'
import type { Image as NitroImage } from 'react-native-nitro-image'
import { NitroModules } from 'react-native-nitro-modules'
import {
  type CameraController,
  type CameraDevice,
  type CameraOutput,
  type CameraPhotoOutput,
  type CameraSession,
  CommonResolutions,
  type Constraint,
  VisionCamera,
} from 'react-native-vision-camera'

import { useAppStore } from '@/stores/appStore'
import { useCameraState } from '@/stores/features/camera'

import type { DualOutputFactory } from '../../../modules/dual-recorder/src/DualOutputFactory.nitro'
import NativeRecorder from '../../../modules/dual-recorder/src/DualRecorderModule'
import { allocateMedia, exportMedia, hydrateProjects, saveMedia, thumbnailFile } from './projects'
import {
  cropSize,
  type MediaType,
  type NativeCapabilities,
  type NativeRecordingResult,
  type OutputKind,
  outputSize,
  type PhotoCapture,
  type PhotoOutput,
  type RecorderStats,
  type RecordingSettings,
  type VideoCapture,
} from './types'

const WAKE_TAG = 'dualzen-recording'
const factory = () => NitroModules.createHybridObject<DualOutputFactory>('DualOutputFactory')
type ControlKind = 'zoom' | 'exposure' | 'torch'
type ControlQueue = { running: boolean; pending: (() => Promise<void>) | null }
export function useCaptureController(active: boolean, mediaType: MediaType) {
  const { t } = useTranslation()
  const { showSnackbar } = useSnackbarState()
  const { settings, phase, photoFlashMode } = useCameraState()
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [pairs, setPairs] = useState<CameraDevice[][]>([])
  const [capabilities, setCapabilities] = useState<NativeCapabilities>({ hdr: false, mov: false })
  const [stats, setStats] = useState<RecorderStats>({
    thermal: 0,
    freeBytes: 0,
    frames: 0,
    dropped: 0,
    recording: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [readyDeviceId, setReadyDeviceId] = useState<string | null>(null)
  const [cameraAuthorized, setCameraAuthorized] = useState(false)
  const [microphoneAuthorized, setMicrophoneAuthorized] = useState(false)
  const [zoom, setZoomLabel] = useState(1)
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 })
  const [focusLocked, setFocusLocked] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [exposureBias, setExposureBias] = useState({ portrait: 0, landscape: 0 })
  const [elapsed, setElapsed] = useState(0)
  const session = useRef<CameraSession | null>(null)
  const lifecycle = useRef<Promise<void>>(Promise.resolve())
  const captureSettings = useMemo(
    () => ({
      longEdge: settings.longEdge,
      fps: settings.fps,
      container: 'mp4' as const,
      hdr: settings.hdr,
      stabilization: settings.stabilization,
      mode: settings.mode,
      front: settings.front,
      deviceId: settings.deviceId,
      pairIndex: settings.pairIndex,
      portraitPosition: 0.5,
      landscapePosition: 0.5,
      grid: false,
    }),
    [
      settings.mode,
      settings.front,
      settings.deviceId,
      settings.pairIndex,
      settings.longEdge,
      settings.fps,
      settings.hdr,
      settings.stabilization,
    ]
  )
  const controllers = useRef<CameraController[]>([])
  const controlQueues = useRef<Record<ControlKind, ControlQueue>>({
    zoom: { running: false, pending: null },
    exposure: { running: false, pending: null },
    torch: { running: false, pending: null },
  })
  const focusSequence = useRef(0)
  const outputs = useRef<CameraOutput[]>([])
  const photoOutputs = useRef<CameraPhotoOutput[]>([])
  const metadata = useRef<{
    id: string
    settings: RecordingSettings
    projectId: string
    createdAt: number
  } | null>(null)
  const handling = useRef<Promise<void> | null>(null)
  const handled = useRef(new Set<string>())
  const previousOrientation = useRef<ScreenOrientation.OrientationLock | null>(null)
  const rearZoomDevice = devices
    .filter(
      (item) =>
        item.position === 'back' &&
        item.isVirtualDevice &&
        item.physicalDevices.some((physical) => physical.type === 'ultra-wide-angle')
    )
    .sort((a, b) => b.physicalDevices.length - a.physicalDevices.length)[0]
  const device =
    settings.mode === 'dual'
      ? pairs[settings.pairIndex]?.[0]
      : (devices.find(
          (item) =>
            item.id === settings.deviceId && item.position === (settings.front ? 'front' : 'back')
        ) ??
        (!settings.front ? rearZoomDevice : undefined) ??
        devices.find(
          (item) =>
            item.position === (settings.front ? 'front' : 'back') &&
            ['wide-angle', 'true-depth'].includes(item.type)
        ) ??
        devices.find((item) => item.position === (settings.front ? 'front' : 'back')))

  const permission = useCallback(async () => {
    try {
      const camera = await VisionCamera.requestCameraPermission()
      setCameraAuthorized(camera)
      if (mediaType === 'video') {
        const microphone = camera && (await VisionCamera.requestMicrophonePermission())
        setMicrophoneAuthorized(microphone)
      }
    } catch (cause) {
      setError(String(cause))
    }
  }, [mediaType])
  useEffect(() => {
    void hydrateProjects().catch((cause) => setError(String(cause)))
    void NativeRecorder.capabilities()
      .then((value) => setCapabilities(JSON.parse(value) as NativeCapabilities))
      .catch((cause) => setError(String(cause)))
    let cancelled = false
    let listener: { remove: () => void } | undefined
    void VisionCamera.createDeviceFactory()
      .then((source) => {
        if (cancelled) return
        setDevices(source.cameraDevices)
        const supportedPairs = new Map<string, CameraDevice[]>()
        const lensRank = (item: CameraDevice) =>
          item.type === 'wide-angle' ? 0 : item.type === 'ultra-wide-angle' ? 1 : 2
        for (const combination of source.supportedMultiCamDeviceCombinations) {
          const rear = combination
            .filter(
              (item) =>
                item.position === 'back' &&
                ['wide-angle', 'ultra-wide-angle', 'telephoto'].includes(item.type)
            )
            .sort((a, b) => lensRank(a) - lensRank(b))
          for (let first = 0; first < rear.length; first++)
            for (let second = first + 1; second < rear.length; second++) {
              const pair = [rear[first], rear[second]]
              supportedPairs.set(
                pair
                  .map((item) => item.id)
                  .sort()
                  .join('|'),
                pair
              )
            }
        }
        setPairs(
          [...supportedPairs.values()].sort(
            (a, b) => lensRank(a[0]) * 3 + lensRank(a[1]) - lensRank(b[0]) * 3 - lensRank(b[1])
          )
        )
        listener = source.addOnCameraDevicesChangedListener(setDevices)
      })
      .catch((cause) => setError(String(cause)))
    setCameraAuthorized(VisionCamera.cameraPermissionStatus === 'authorized')
    setMicrophoneAuthorized(VisionCamera.microphonePermissionStatus === 'authorized')
    return () => {
      cancelled = true
      listener?.remove()
    }
  }, [])

  const authorized = cameraAuthorized && (mediaType === 'photo' || microphoneAuthorized)

  const configuration = useCallback(
    (output: CameraOutput, candidate: RecordingSettings): Constraint[] => {
      if (Platform.OS === 'android' && candidate.mode === 'dual') return []
      const stabilization = candidate.stabilization ? 'standard' : 'off'
      return [
        { fps: candidate.fps },
        {
          videoDynamicRange: {
            bitDepth: candidate.hdr ? 'hdr-10-bit' : 'sdr-8-bit',
            colorSpace: candidate.hdr ? 'hlg-bt2020' : 'srgb',
            colorRange: 'video',
          },
        },
        { resolutionBias: output },
        Platform.OS === 'android'
          ? { previewStabilizationMode: stabilization }
          : { videoStabilizationMode: stabilization },
      ]
    },
    []
  )
  const checkSettings = useCallback(
    async (candidate: RecordingSettings): Promise<boolean> => {
      try {
        if (
          (candidate.hdr && !capabilities.hdr) ||
          (candidate.container === 'mov' && !capabilities.mov)
        )
          return false
        const selected =
          devices.find(
            (item) =>
              item.id === candidate.deviceId &&
              item.position === (candidate.front ? 'front' : 'back')
          ) ?? device
        const inputs =
          candidate.mode === 'dual' ? pairs[candidate.pairIndex] : selected ? [selected] : []
        if (
          !inputs?.length ||
          !(await NativeRecorder.canEncode(candidate.longEdge, candidate.fps, candidate.hdr))
        )
          return false
        if (Platform.OS === 'android' && candidate.mode === 'dual')
          return candidate.fps === 30 && !candidate.hdr && !candidate.stabilization
        for (const input of inputs) {
          const output = factory().createOutput(0, candidate.longEdge, candidate.hdr)
          const resolved = await VisionCamera.resolveConstraints(
            input,
            [{ output, mirrorMode: 'off' }],
            configuration(output, candidate)
          )
          if (resolved.selectedFPS !== candidate.fps) return false
          if (
            candidate.hdr &&
            (resolved.selectedVideoDynamicRange?.bitDepth !== 'hdr-10-bit' ||
              resolved.selectedVideoDynamicRange.colorSpace !== 'hlg-bt2020' ||
              resolved.selectedVideoDynamicRange.colorRange !== 'video')
          )
            return false
          const stabilization =
            Platform.OS === 'android'
              ? resolved.selectedPreviewStabilizationMode
              : resolved.selectedVideoStabilizationMode
          if (candidate.stabilization && stabilization !== 'standard') return false
        }
        return true
      } catch {
        return false
      }
    },
    [capabilities, configuration, device, devices, pairs]
  )

  const releaseLocks = useCallback(async () => {
    await deactivateKeepAwake(WAKE_TAG).catch(() => {})
    if (previousOrientation.current !== null) {
      await ScreenOrientation.lockAsync(previousOrientation.current).catch(() => {})
      previousOrientation.current = null
    }
  }, [])
  const complete = useCallback(
    async (result: NativeRecordingResult) => {
      if (!result.id || handled.current.has(result.id) || metadata.current?.id !== result.id) return
      handled.current.add(result.id)
      const meta = metadata.current
      const task = (async () => {
        useAppStore.getState().camera.setPhase('finalizing')
        try {
          const video: VideoCapture = {
            ...meta,
            mediaType: 'video',
            duration: result.duration,
            outputs: result.outputs,
            trim: null,
            exports: [],
            reason: result.reason,
            ...(result.error ? { error: result.error } : {}),
          }
          if (video.outputs.some((output) => output.ready)) {
            await saveMedia(video)
            const output = video.outputs.find((item) => item.ready)!
            const source = allocateExistingVideo(video, output.filename)
            await NativeRecorder.thumbnail(source, thumbnailFile(video.id).uri).catch(() => {})
            if (video.outputs.every((item) => item.ready) && !video.error) {
              showSnackbar({ title: t('camera.saved'), variant: 'success' })
            } else setNotice('partialSave')
            useAppStore.getState().camera.setPhase('idle')
            if (useAppStore.getState().camera.autoSaveToLibrary) {
              const exported = await exportMedia(
                video,
                video.outputs.filter((item) => item.ready).map((item) => item.kind)
              )
              if (exported.some((item) => item.error)) setNotice('exportFailed')
            }
          } else
            setError(
              result.error ?? result.outputs.find((item) => item.error)?.error ?? 'saveFailed'
            )
          if (['storage', 'thermal', 'interruption'].includes(result.reason))
            setNotice(result.reason)
        } catch (cause) {
          setError(String(cause))
        } finally {
          metadata.current = null
          useAppStore.getState().camera.setPhase('finalizing')
          await releaseLocks()
          useAppStore.getState().camera.setPhase('idle')
        }
      })()
      handling.current = task
      await task
      handling.current = null
    },
    [releaseLocks, showSnackbar, t]
  )
  const stop = useCallback(async () => {
    if (!metadata.current || useAppStore.getState().camera.phase !== 'recording') return
    useAppStore.getState().camera.setPhase('finalizing')
    try {
      await complete(JSON.parse(await NativeRecorder.stop()) as NativeRecordingResult)
      await handling.current
    } catch (cause) {
      setError(String(cause))
      useAppStore.getState().camera.setPhase('idle')
      await releaseLocks()
    }
  }, [complete, releaseLocks])
  useEffect(() => {
    const listener = NativeRecorder.addListener('onStopped', (event) => {
      void complete(JSON.parse(event.result) as NativeRecordingResult)
    })
    return () => listener.remove()
  }, [complete])
  useEffect(() => {
    let cancelled = false
    let polling = false
    const poll = async () => {
      if (polling) return
      polling = true
      try {
        const value = JSON.parse(await NativeRecorder.stats()) as RecorderStats
        if (!cancelled) {
          setStats(value)
          if (metadata.current)
            setElapsed(Math.max(0, (Date.now() - metadata.current.createdAt) / 1000))
        }
      } catch (cause) {
        if (!cancelled) setError(String(cause))
      } finally {
        polling = false
      }
    }
    void poll()
    const timer = setInterval(() => {
      void poll()
    }, 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void stop()
    })
    return () => subscription.remove()
  }, [stop])
  useEffect(() => {
    if (!active || !authorized || !device) {
      setReady(false)
      setReadyDeviceId(null)
      return
    }
    let cancelled = false
    const invalidateFocus = () => {
      focusSequence.current++
    }
    let localSession: CameraSession | null = null
    const subscriptions: { remove: () => void }[] = []
    const orientation = VisionCamera.createOrientationManager('interface')
    setReady(false)
    setReadyDeviceId(null)
    setFocusLocked(false)
    setTorchEnabled(false)
    setExposureBias({ portrait: 0, landscape: 0 })
    setError(null)
    const setup = lifecycle.current
      .then(async () => {
        if (cancelled) return
        if (mediaType === 'video' && !(await checkSettings(captureSettings))) {
          // A default stabilization preference may be unavailable on the selected camera.
          if (
            captureSettings.stabilization &&
            (await checkSettings({ ...captureSettings, stabilization: false }))
          ) {
            useAppStore.getState().camera.updateSettings({ stabilization: false })
            return
          }
          throw new Error('unsupportedSettings')
        }
        const source = captureSettings.mode === 'dual' ? pairs[captureSettings.pairIndex] : [device]
        localSession = await VisionCamera.createCameraSession(captureSettings.mode === 'dual')
        if (cancelled) {
          return
        }
        const recordingOutputs = source.map((_, index) =>
          factory().createOutput(
            captureSettings.mode === 'dual' ? index + 1 : 0,
            mediaType === 'video' ? captureSettings.longEdge : 1920,
            mediaType === 'video' && captureSettings.hdr
          )
        )
        const stillOutputs =
          mediaType === 'photo'
            ? source.map(() =>
                VisionCamera.createPhotoOutput({
                  targetResolution: CommonResolutions.UHD_4_3,
                  containerFormat: 'jpeg',
                  quality: 0.9,
                  qualityPrioritization: 'quality',
                })
              )
            : []
        ;[...recordingOutputs, ...stillOutputs].forEach((output) => {
          output.outputOrientation = orientation.currentOrientation ?? 'up'
        })
        outputs.current = recordingOutputs
        photoOutputs.current = stillOutputs
        subscriptions.push(
          localSession.addOnErrorListener((cause) => {
            setError(cause.message)
            void stop()
          })
        )
        subscriptions.push(
          localSession.addOnInterruptionStartedListener(() => {
            setNotice('interruption')
            void stop()
          })
        )
        const controls = await localSession.configure(
          source.map((input, index) => ({
            input,
            outputs: [recordingOutputs[index], stillOutputs[index]]
              .filter((output): output is CameraOutput => output !== undefined)
              .map((output) => ({ output, mirrorMode: 'off' as const })),
            constraints:
              mediaType === 'video' ? configuration(recordingOutputs[index], captureSettings) : [],
            onSessionConfigSelected: (selected) => {
              if (mediaType !== 'video') return
              const stabilization =
                Platform.OS === 'android'
                  ? selected.selectedPreviewStabilizationMode
                  : selected.selectedVideoStabilizationMode
              if (
                !(Platform.OS === 'android' && captureSettings.mode === 'dual') &&
                (selected.selectedFPS !== captureSettings.fps ||
                  (captureSettings.stabilization && stabilization !== 'standard') ||
                  (captureSettings.hdr &&
                    (selected.selectedVideoDynamicRange?.bitDepth !== 'hdr-10-bit' ||
                      selected.selectedVideoDynamicRange.colorSpace !== 'hlg-bt2020' ||
                      selected.selectedVideoDynamicRange.colorRange !== 'video')))
              )
                setError('unsupportedSettings')
            },
          })),
          {}
        )
        if (cancelled) {
          await localSession.stop()
          return
        }
        ;[...recordingOutputs, ...stillOutputs].forEach((output) => {
          output.outputOrientation = orientation.currentOrientation ?? 'up'
        })
        controllers.current = controls
        const ranges = controls.map((control) => {
          const factor = control.zoom / control.displayableZoomFactor
          return { min: control.minZoom / factor, max: control.maxZoom / factor }
        })
        const range = {
          min: Math.max(...ranges.map((item) => item.min)),
          max: Math.min(...ranges.map((item) => item.max)),
        }
        setZoomRange(range)
        const initialZoom = Math.max(range.min, Math.min(range.max, 1))
        await Promise.all(
          controls.map((control) =>
            control.setZoom(
              Math.max(
                control.minZoom,
                Math.min(
                  control.maxZoom,
                  initialZoom * (control.zoom / control.displayableZoomFactor)
                )
              )
            )
          )
        )
        session.current = localSession
        orientation.startOrientationUpdates((value) => {
          if (useAppStore.getState().camera.phase === 'idle') {
            ;[...recordingOutputs, ...stillOutputs].forEach((output) => {
              output.outputOrientation = value
            })
          }
        })
        await localSession.start()
        if (!cancelled) {
          setReady(true)
          setReadyDeviceId(device.id)
          setZoomLabel(controls[0]?.displayableZoomFactor ?? 1)
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      })
    lifecycle.current = setup
    return () => {
      cancelled = true
      invalidateFocus()
      setFocusLocked(false)
      setReady(false)
      setReadyDeviceId(null)
      orientation.stopOrientationUpdates()
      subscriptions.forEach((subscription) => subscription.remove())
      if (session.current === localSession) {
        session.current = null
        controllers.current = []
        photoOutputs.current = []
      }
      lifecycle.current = setup
        .then(async () => {
          await stop()
          if (localSession) {
            await localSession.stop().catch(() => {})
            localSession.dispose()
          }
        })
        .catch(() => {})
    }
    // Settings are frozen throughout a take. Orientation and controls do not recreate this session.
  }, [
    active,
    authorized,
    device,
    pairs,
    captureSettings,
    configuration,
    checkSettings,
    stop,
    mediaType,
  ])

  const startVideo = async () => {
    if (
      mediaType !== 'video' ||
      !ready ||
      error ||
      handling.current ||
      useAppStore.getState().camera.phase !== 'idle'
    )
      return
    useAppStore.getState().camera.setPhase('preparing')
    setNotice(null)
    setElapsed(0)
    try {
      const orientation = await ScreenOrientation.getOrientationAsync()
      previousOrientation.current = await ScreenOrientation.getOrientationLockAsync()
      const lock =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT
          ? ScreenOrientation.OrientationLock.LANDSCAPE_LEFT
          : orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
            ? ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
            : ScreenOrientation.OrientationLock.PORTRAIT_UP
      await ScreenOrientation.lockAsync(lock)
      await activateKeepAwakeAsync(WAKE_TAG)
      if (AppState.currentState !== 'active') throw new Error('interruption')
      const allocation = allocateMedia()
      metadata.current = {
        id: allocation.id,
        settings: { ...settings },
        projectId: useAppStore.getState().projects.selectedProjectId,
        createdAt: Date.now(),
      }
      await NativeRecorder.start(
        JSON.stringify({
          ...settings,
          ...metadata.current,
          directory: allocation.directory.uri,
          portraitPosition: settings.front
            ? 1 - settings.portraitPosition
            : settings.portraitPosition,
          landscapePosition: settings.front
            ? 1 - settings.landscapePosition
            : settings.landscapePosition,
          reserveBytes: Math.max(256 * 1024 * 1024, bytesPerSecond * 15),
        })
      )
      if (metadata.current && !handled.current.has(allocation.id))
        useAppStore.getState().camera.setPhase('recording')
      if (AppState.currentState !== 'active') await stop()
    } catch (cause) {
      metadata.current = null
      setError(String(cause))
      useAppStore.getState().camera.setPhase('idle')
      await releaseLocks()
    }
  }
  const takePhoto = async () => {
    if (
      mediaType !== 'photo' ||
      !ready ||
      error ||
      handling.current ||
      !photoOutputs.current.length ||
      useAppStore.getState().camera.phase !== 'idle'
    )
      return
    useAppStore.getState().camera.setPhase('capturing')
    setNotice(null)
    const allocation = allocateMedia()
    try {
      const selectedFlash =
        settings.mode === 'single' && !settings.front && device?.hasFlash ? photoFlashMode : 'off'
      const captures = await Promise.allSettled(
        photoOutputs.current.map((output) =>
          output.capturePhoto(
            {
              flashMode: selectedFlash,
              enableShutterSound: true,
              enableDistortionCorrection: false,
            },
            {}
          )
        )
      )
      useAppStore.getState().camera.setPhase('finalizing')
      const positions = {
        portrait: settings.front ? 1 - settings.portraitPosition : settings.portraitPosition,
        landscape: settings.front ? 1 - settings.landscapePosition : settings.landscapePosition,
      }
      const photoResults: PhotoOutput[] = []
      if (settings.mode === 'single') {
        const capture = captures[0]
        if (capture?.status === 'fulfilled') {
          let image: NitroImage | null = null
          try {
            image = await capture.value.toImageAsync()
            for (const kind of ['portrait', 'landscape'] as const) {
              try {
                photoResults.push(
                  await savePhotoOutput(
                    image,
                    allocation.directory,
                    kind,
                    positions[kind],
                    !thumbnailFile(allocation.id).exists
                  )
                )
              } catch (cause) {
                photoResults.push(failedPhotoOutput(kind, cause))
              }
            }
          } finally {
            image?.dispose()
            capture.value.dispose()
          }
        } else {
          photoResults.push(failedPhotoOutput('portrait', capture?.reason))
          photoResults.push(failedPhotoOutput('landscape', capture?.reason))
        }
      } else {
        for (const [index, kind] of (['portrait', 'landscape'] as const).entries()) {
          const capture = captures[index]
          if (capture?.status !== 'fulfilled') {
            photoResults.push(failedPhotoOutput(kind, capture?.reason))
            continue
          }
          let image: NitroImage | null = null
          try {
            image = await capture.value.toImageAsync()
            photoResults.push(
              await savePhotoOutput(
                image,
                allocation.directory,
                kind,
                positions[kind],
                !thumbnailFile(allocation.id).exists
              )
            )
          } catch (cause) {
            photoResults.push(failedPhotoOutput(kind, cause))
          } finally {
            image?.dispose()
            capture.value.dispose()
          }
        }
      }
      if (!photoResults.some((output) => output.ready)) {
        if (allocation.directory.exists) allocation.directory.delete()
        throw new Error(
          photoResults.find((output) => output.error)?.error ?? 'Photo capture failed'
        )
      }
      const photo: PhotoCapture = {
        id: allocation.id,
        projectId: useAppStore.getState().projects.selectedProjectId,
        createdAt: Date.now(),
        mediaType: 'photo',
        settings: {
          mode: settings.mode,
          front: settings.front,
          deviceId: settings.deviceId,
          pairIndex: settings.pairIndex,
          portraitPosition: settings.portraitPosition,
          landscapePosition: settings.landscapePosition,
          container: 'jpeg',
          quality: 0.9,
          targetResolution: CommonResolutions.UHD_4_3,
          flashMode: selectedFlash,
        },
        outputs: photoResults,
        exports: [],
        ...(photoResults.some((output) => !output.ready)
          ? { error: photoResults.find((output) => output.error)?.error ?? 'Partial photo capture' }
          : {}),
      }
      await saveMedia(photo)
      if (photo.outputs.every((output) => output.ready))
        showSnackbar({ title: t('camera.photoSaved'), variant: 'success' })
      else setNotice('partialPhotoSave')
      useAppStore.getState().camera.setPhase('idle')
      if (useAppStore.getState().camera.autoSaveToLibrary) {
        const exported = await exportMedia(
          photo,
          photo.outputs.filter((output) => output.ready).map((output) => output.kind)
        )
        if (exported.some((item) => item.error)) setNotice('exportFailed')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      useAppStore.getState().camera.setPhase('idle')
    }
  }
  const updateControl = async (kind: ControlKind, work: () => Promise<void>) => {
    const target = session.current
    if (!target) return
    const queue = controlQueues.current[kind]
    // CameraX cancels a pending control when another request replaces it. Keep
    // one active request and the latest value instead of accumulating promises.
    queue.pending = async () => {
      if (session.current !== target) return
      try {
        await work()
      } catch (cause) {
        if (session.current === target) setNotice(String(cause))
      }
    }
    if (queue.running) return
    queue.running = true
    try {
      while (queue.pending) {
        const next = queue.pending
        queue.pending = null
        await next()
      }
    } finally {
      queue.running = false
    }
  }
  const setZoom = (displayable: number, animated = false) =>
    updateControl('zoom', async () => {
      const controls = controllers.current
      const value = Math.max(zoomRange.min, Math.min(zoomRange.max, displayable))
      await Promise.all(
        controls.map(async (control) => {
          const factor = control.zoom / control.displayableZoomFactor
          const target = Math.max(control.minZoom, Math.min(control.maxZoom, value * factor))
          if (control === controls[0]) setZoomLabel(target / factor)
          if (animated) {
            // VisionCamera 5.2 uses milliseconds on Android and zoom units/sec on iOS.
            await control.startZoomAnimation(target, Platform.OS === 'android' ? 350 : 3)
          } else {
            await control.cancelZoomAnimation()
            await control.setZoom(target)
          }
        })
      )
      if (controllers.current === controls) setZoomLabel(controls[0]?.displayableZoomFactor ?? 1)
    })
  const focus = async (x: number, y: number, kind: OutputKind = 'portrait', locked = false) => {
    const sequence = ++focusSequence.current
    const target = session.current
    const controls = controllers.current
    setFocusLocked(false)
    try {
      await Promise.all(controls.map((control) => control.resetFocus()))
      if (sequence !== focusSequence.current || session.current !== target) return false
      const index = settings.mode === 'dual' && kind === 'landscape' ? 1 : 0
      const selected = locked ? controls : controls.slice(index, index + 1)
      if (
        !selected.length ||
        (locked &&
          selected.some(
            (control) =>
              !control.device.supportsFocusMetering || !control.device.supportsExposureMetering
          ))
      ) {
        setNotice('focusUnavailable')
        return false
      }
      await Promise.all(
        selected.map(async (control) => {
          const sourceIndex = controls.indexOf(control)
          const source =
            settings.mode === 'dual'
              ? sourceIndex === 0
                ? stats.source1
                : stats.source2
              : stats.source0
          const rotation = ((Math.round(source?.rotation ?? 0) % 360) + 360) % 360
          const coordinates =
            rotation === 90
              ? [y, 1 - x]
              : rotation === 180
                ? [1 - x, 1 - y]
                : rotation === 270
                  ? [1 - y, x]
                  : [x, y]
          const point = VisionCamera.createNormalizedMeteringPoint(
            Math.max(0, Math.min(1, coordinates[0])),
            Math.max(0, Math.min(1, coordinates[1]))
          )
          const modes: ('AE' | 'AF')[] = []
          if (control.device.supportsExposureMetering) modes.push('AE')
          if (control.device.supportsFocusMetering) modes.push('AF')
          if (!modes.length) return
          await control.focusTo(point, {
            modes,
            responsiveness: phase === 'recording' ? 'steady' : 'snappy',
            adaptiveness: locked ? 'locked' : 'continuous',
            autoResetAfter: locked ? null : 5,
          })
        })
      )
      if (sequence !== focusSequence.current || session.current !== target) return false
      setFocusLocked(locked)
      return true
    } catch (cause) {
      if (sequence === focusSequence.current && session.current === target) {
        // A partial multi-camera lock must not leave one lens silently locked.
        await Promise.all(controls.map((control) => control.resetFocus().catch(() => {})))
        if (sequence === focusSequence.current) setNotice(String(cause))
      }
      return false
    }
  }
  const unlockFocus = async () => {
    const sequence = ++focusSequence.current
    const target = session.current
    setFocusLocked(false)
    try {
      await Promise.all(controllers.current.map((control) => control.resetFocus()))
    } catch (cause) {
      if (sequence === focusSequence.current && session.current === target) setNotice(String(cause))
    }
  }
  const exposureRange = (kind: OutputKind) => {
    const input =
      settings.mode === 'dual' ? pairs[settings.pairIndex]?.[kind === 'portrait' ? 0 : 1] : device
    return {
      supported: input?.supportsExposureBias ?? false,
      min: input?.minExposureBias ?? 0,
      max: input?.maxExposureBias ?? 0,
    }
  }
  const torch = (on: boolean) =>
    updateControl('torch', async () => {
      const controls = controllers.current
      await Promise.all(
        controls
          .filter((control) => control.device.hasTorch)
          .map((control) => control.setTorchMode(on ? 'on' : 'off'))
      )
      if (controllers.current === controls) setTorchEnabled(on)
    })
  const exposure = (value: number, kind: OutputKind = 'portrait') =>
    updateControl('exposure', async () => {
      const controls = controllers.current
      const index = settings.mode === 'dual' && kind === 'landscape' ? 1 : 0
      const selected = focusLocked ? controls : controls.slice(index, index + 1)
      await Promise.all(
        selected
          .filter((control) => control.device.supportsExposureBias)
          .map(async (control) => {
            const bias = Math.max(
              control.device.minExposureBias,
              Math.min(control.device.maxExposureBias, value)
            )
            await control.setExposureBias(bias)
            if (controllers.current !== controls) return
            const controlKind = controls.indexOf(control) === 1 ? 'landscape' : 'portrait'
            setExposureBias((previous) =>
              settings.mode === 'single'
                ? { portrait: bias, landscape: bias }
                : { ...previous, [controlKind]: bias }
            )
          })
      )
    })
  const sources =
    settings.mode === 'dual' ? [stats.source1, stats.source2] : [stats.source0, stats.source0]
  const sizes =
    mediaType === 'photo'
      ? (['portrait', 'landscape'] as const).map((kind) =>
          cropSize(CommonResolutions.UHD_4_3, kind)
        )
      : sources.map((source, index) =>
          source
            ? outputSize(source, index === 0 ? 'portrait' : 'landscape', settings.longEdge)
            : null
        )
  const bytesPerSecond =
    ((sizes.reduce(
      (total, size) =>
        total +
        (size
          ? Math.max(4e6, size.width * size.height * settings.fps * (settings.hdr ? 0.14 : 0.18))
          : 4e6),
      0
    ) +
      256000) /
      8) *
    1.03
  const remaining = Math.max(
    0,
    (stats.freeBytes - Math.max(256 * 1024 * 1024, bytesPerSecond * 15)) / bytesPerSecond
  )
  return {
    settings,
    mediaType,
    phase,
    ready,
    readyDeviceId,
    authorized,
    permission,
    devices,
    pairs,
    device,
    capabilities,
    stats,
    sizes,
    error,
    notice,
    elapsed,
    zoom,
    zoomRange,
    zoomPresets: [0.5, 1, 2, 5].filter(
      (value) => value >= zoomRange.min - 0.001 && value <= zoomRange.max + 0.001
    ),
    setZoom,
    focus,
    focusLocked,
    unlockFocus,
    exposureBias,
    exposureRange,
    torch,
    torchEnabled,
    exposure,
    startVideo,
    stopVideo: stop,
    takePhoto,
    checkSettings,
    remaining,
    bytesPerSecond,
    clearError: () => setError(null),
  }
}
function allocateExistingVideo(video: VideoCapture, filename: string) {
  return thumbnailFile(video.id).parentDirectory.uri + filename
}

function failedPhotoOutput(kind: OutputKind, cause: unknown): PhotoOutput {
  return {
    kind,
    filename: `${kind}.jpg`,
    width: 0,
    height: 0,
    bytes: 0,
    ready: false,
    error: cause instanceof Error ? cause.message : String(cause ?? 'Photo capture failed'),
  }
}

async function savePhotoOutput(
  image: NitroImage,
  directory: ReturnType<typeof allocateMedia>['directory'],
  kind: OutputKind,
  position: number,
  createThumbnail: boolean
): Promise<PhotoOutput> {
  const { width, height } = cropSize(image, kind)
  const p = Math.max(0, Math.min(1, position))
  const x = (image.width - width) * p
  const y = (image.height - height) * (1 - p)
  const cropped = await image.cropAsync(x, y, x + width, y + height)
  try {
    const filename = `${kind}.jpg`
    const destination = new File(directory, filename)
    await cropped.saveToFileAsync(filePath(destination.uri), 'jpg', 90)
    if (createThumbnail) {
      const scale = Math.min(1, 480 / Math.max(cropped.width, cropped.height))
      const thumbnail = await cropped.resizeAsync(
        Math.max(1, Math.round(cropped.width * scale)),
        Math.max(1, Math.round(cropped.height * scale))
      )
      try {
        await thumbnail.saveToFileAsync(filePath(thumbnailFile(directory.name).uri), 'jpg', 80)
      } finally {
        thumbnail.dispose()
      }
    }
    return {
      kind,
      filename,
      width: cropped.width,
      height: cropped.height,
      bytes: destination.size,
      ready: true,
    }
  } finally {
    cropped.dispose()
  }
}

function filePath(uri: string) {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''))
}

export type CaptureController = ReturnType<typeof useCaptureController>
