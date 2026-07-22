import {
  AudioContext,
  type AudioEventSubscription,
  AudioManager,
  AudioRecorder,
  type GainNode,
  type OscillatorNode,
  type PermissionStatus,
  type StereoPannerNode,
} from 'react-native-audio-api'

import { AnalyticsAppEvents, trackEvent } from '@/services/firebase/analytics'

import {
  calculateRms,
  classifyMeterBand,
  dbfsToEstimatedDb,
  rmsToDbfs,
  smoothMeterValue,
} from './audioMath'
import type {
  AudioSnapshot,
  AudioStopReason,
  MeterStartResult,
  MeterStats,
  OutputRouteKind,
} from './types'

const EJECT_GAIN = 0.65
const TOOL_GAIN = 0.35
const GAIN_RAMP_SECONDS = 0.045
const EJECT_CYCLE_SECONDS = 2.5
const METER_SAMPLE_RATE = 16_000
const METER_BUFFER_LENGTH = 1_600
const AUTO_STEREO_DURATION_SECONDS = 8

const getDurationBucket = (elapsedSeconds: number): string => {
  if (elapsedSeconds < 10) return 'under_10s'
  if (elapsedSeconds < 30) return '10_to_29s'
  if (elapsedSeconds < 60) return '30_to_59s'
  return '60s_plus'
}

const createEmptyMeterStats = (): MeterStats => ({
  currentDb: 0,
  minimumDb: 0,
  averageDb: 0,
  maximumDb: 0,
  sampleCount: 0,
  band: 'veryQuiet',
})

const createInitialSnapshot = (): AudioSnapshot => ({
  status: 'idle',
  activeTool: null,
  lastTool: null,
  stopReason: null,
  errorMessage: null,
  elapsedSeconds: 0,
  durationSeconds: null,
  frequencyHz: 440,
  stereoPan: 0,
  stereoMode: null,
  meter: createEmptyMeterStats(),
  microphonePermission: 'Undetermined',
  outputRouteKind: 'unknown',
  outputRouteName: null,
})

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown audio error'

const classifyOutputRoute = (
  name: string,
  category: string
): { kind: OutputRouteKind; name: string } => {
  const route = `${name} ${category}`.toLowerCase()
  const isExternal = /bluetooth|headphone|headset|airplay|a2dp|usb|hdmi|car/.test(route)
  const isDevice = /speaker|receiver|earpiece|built-in|builtin/.test(route)

  return {
    kind: isExternal ? 'external' : isDevice ? 'device' : 'unknown',
    name,
  }
}

class AudioController {
  private snapshot = createInitialSnapshot()
  private readonly listeners = new Set<() => void>()
  private operation: Promise<void> = Promise.resolve()
  private context: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private gain: GainNode | null = null
  private panner: StereoPannerNode | null = null
  private recorder: AudioRecorder | null = null
  private ticker: ReturnType<typeof setInterval> | null = null
  private completionTimer: ReturnType<typeof setTimeout> | null = null
  private startedAtMs: number | null = null
  private interruptionSubscription: AudioEventSubscription | null = null
  private routeSubscription: AudioEventSubscription | null = null
  private systemListenersReady = false

  getSnapshot = (): AudioSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private update = (patch: Partial<AudioSnapshot>) => {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  private enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const result = this.operation.then(action, action)
    this.operation = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private ensureSystemListeners = () => {
    if (this.systemListenersReady) return
    this.systemListenersReady = true

    this.interruptionSubscription = AudioManager.addSystemEventListener(
      'interruption',
      ({ type }) => {
        if (type === 'began' && this.snapshot.activeTool) {
          void this.stop('interruption')
        }
      }
    )

    this.routeSubscription = AudioManager.addSystemEventListener('routeChange', ({ reason }) => {
      void this.refreshOutputRoute()
      if (
        this.snapshot.activeTool &&
        (reason === 'OldDeviceUnavailable' || reason === 'NoSuitableRouteForCategory')
      ) {
        void this.stop('route-change')
      }
    })
  }

  refreshOutputRoute = async (): Promise<void> => {
    try {
      const devices = await AudioManager.getDevicesInfo()
      const output = devices.currentOutputs[0]
      if (!output) {
        this.update({ outputRouteKind: 'unknown', outputRouteName: null })
        return
      }

      const route = classifyOutputRoute(output.name, output.category)
      this.update({ outputRouteKind: route.kind, outputRouteName: route.name })
    } catch {
      this.update({ outputRouteKind: 'unknown', outputRouteName: null })
    }
  }

  checkMicrophonePermission = async (): Promise<PermissionStatus> => {
    this.ensureSystemListeners()
    const permission = await AudioManager.checkRecordingPermissions()
    this.update({ microphonePermission: permission })
    return permission
  }

  private preparePlayback = async () => {
    this.ensureSystemListeners()
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: [],
      iosNotifyOthersOnDeactivation: true,
    })
    AudioManager.observeAudioInterruptions('gainTransient')
    await AudioManager.setAudioSessionActivity(true)
    await this.refreshOutputRoute()
  }

  private createPlaybackGraph = async (frequencyHz: number, gainValue: number, pan = 0) => {
    const context = new AudioContext()
    await context.resume()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const panner = context.createStereoPanner()

    oscillator.type = 'sine'
    oscillator.frequency.value = frequencyHz
    gain.gain.value = 0
    panner.pan.value = pan

    oscillator.connect(gain)
    gain.connect(panner)
    panner.connect(context.destination)

    oscillator.start(context.currentTime)
    gain.gain.setValueAtTime(0, context.currentTime)
    gain.gain.linearRampToValueAtTime(gainValue, context.currentTime + GAIN_RAMP_SECONDS)

    this.context = context
    this.oscillator = oscillator
    this.gain = gain
    this.panner = panner
  }

  startEject = (durationSeconds: number): Promise<void> =>
    this.enqueue(async () => {
      await this.performStop('replaced')
      this.update({
        status: 'starting',
        activeTool: 'eject',
        stopReason: null,
        errorMessage: null,
        elapsedSeconds: 0,
        durationSeconds,
        frequencyHz: 165,
        stereoMode: null,
      })

      try {
        await this.preparePlayback()
        await this.createPlaybackGraph(150, EJECT_GAIN)

        const context = this.context
        const oscillator = this.oscillator
        const gain = this.gain
        if (!context || !oscillator || !gain) throw new Error('Audio graph could not start')

        const startTime = context.currentTime
        oscillator.frequency.cancelScheduledValues(startTime)
        gain.gain.cancelScheduledValues(startTime)

        for (let offset = 0; offset < durationSeconds; offset += EJECT_CYCLE_SECONDS) {
          const cycleStart = startTime + offset
          const cycleEnd = Math.min(cycleStart + EJECT_CYCLE_SECONDS, startTime + durationSeconds)
          const middle = Math.min(cycleStart + EJECT_CYCLE_SECONDS / 2, cycleEnd)

          oscillator.frequency.setValueAtTime(150, cycleStart)
          oscillator.frequency.linearRampToValueAtTime(220, middle)
          oscillator.frequency.linearRampToValueAtTime(150, cycleEnd)

          gain.gain.setValueAtTime(0, cycleStart)
          gain.gain.linearRampToValueAtTime(EJECT_GAIN, Math.min(cycleStart + 0.08, cycleEnd))
          gain.gain.setValueAtTime(EJECT_GAIN, Math.max(cycleStart, cycleEnd - 0.1))
          gain.gain.linearRampToValueAtTime(0, cycleEnd)
        }

        this.startedAtMs = Date.now()
        this.update({ status: 'running' })
        trackEvent(AnalyticsAppEvents.AUDIO_TOOL_STARTED, {
          tool: 'eject',
          mode: 'cleaning_cycle',
          duration_s: durationSeconds,
        })
        this.startTicker(durationSeconds)
        this.completionTimer = setTimeout(() => {
          void this.stop('completed')
        }, durationSeconds * 1_000)
      } catch (error) {
        await this.fail(error)
      }
    })

  startTone = (frequencyHz: number): Promise<void> =>
    this.enqueue(async () => {
      await this.performStop('replaced')
      this.update({
        status: 'starting',
        activeTool: 'tone',
        stopReason: null,
        errorMessage: null,
        elapsedSeconds: 0,
        durationSeconds: null,
        frequencyHz,
        stereoMode: null,
      })

      try {
        await this.preparePlayback()
        await this.createPlaybackGraph(frequencyHz, TOOL_GAIN)
        this.startedAtMs = Date.now()
        this.update({ status: 'running' })
        trackEvent(AnalyticsAppEvents.AUDIO_TOOL_STARTED, { tool: 'tone', mode: 'sine' })
        this.startTicker()
      } catch (error) {
        await this.fail(error)
      }
    })

  setToneFrequency = (frequencyHz: number) => {
    this.update({ frequencyHz })
    if (this.snapshot.activeTool !== 'tone' || !this.context || !this.oscillator) return

    const now = this.context.currentTime
    this.oscillator.frequency.cancelAndHoldAtTime(now)
    this.oscillator.frequency.setTargetAtTime(frequencyHz, now, 0.015)
  }

  startStereoManual = (pan: number): Promise<void> => {
    if (this.snapshot.activeTool === 'stereo' && this.snapshot.stereoMode === 'manual') {
      this.setStereoPan(pan)
      return Promise.resolve()
    }

    return this.enqueue(async () => {
      await this.performStop('replaced')
      this.update({
        status: 'starting',
        activeTool: 'stereo',
        stopReason: null,
        errorMessage: null,
        elapsedSeconds: 0,
        durationSeconds: null,
        frequencyHz: 700,
        stereoPan: pan,
        stereoMode: 'manual',
      })

      try {
        await this.preparePlayback()
        await this.createPlaybackGraph(700, TOOL_GAIN, pan)
        this.startedAtMs = Date.now()
        this.update({ status: 'running' })
        trackEvent(AnalyticsAppEvents.AUDIO_TOOL_STARTED, { tool: 'stereo', mode: 'manual' })
        this.startTicker()
      } catch (error) {
        await this.fail(error)
      }
    })
  }

  setStereoPan = (pan: number) => {
    const safePan = Math.min(Math.max(pan, -1), 1)
    this.update({ stereoPan: safePan })
    if (this.snapshot.activeTool !== 'stereo' || !this.context || !this.panner) return

    const now = this.context.currentTime
    this.panner.pan.cancelAndHoldAtTime(now)
    this.panner.pan.linearRampToValueAtTime(safePan, now + 0.12)
  }

  startStereoAuto = (): Promise<void> =>
    this.enqueue(async () => {
      await this.performStop('replaced')
      this.update({
        status: 'starting',
        activeTool: 'stereo',
        stopReason: null,
        errorMessage: null,
        elapsedSeconds: 0,
        durationSeconds: AUTO_STEREO_DURATION_SECONDS,
        frequencyHz: 700,
        stereoPan: -1,
        stereoMode: 'auto',
      })

      try {
        await this.preparePlayback()
        await this.createPlaybackGraph(700, TOOL_GAIN, -1)
        const context = this.context
        const panner = this.panner
        if (!context || !panner) throw new Error('Stereo graph could not start')

        const now = context.currentTime
        panner.pan.setValueAtTime(-1, now)
        panner.pan.linearRampToValueAtTime(1, now + AUTO_STEREO_DURATION_SECONDS / 2)
        panner.pan.linearRampToValueAtTime(-1, now + AUTO_STEREO_DURATION_SECONDS)

        this.startedAtMs = Date.now()
        this.update({ status: 'running' })
        trackEvent(AnalyticsAppEvents.AUDIO_TOOL_STARTED, { tool: 'stereo', mode: 'auto' })
        this.startTicker(AUTO_STEREO_DURATION_SECONDS, true)
        this.completionTimer = setTimeout(() => {
          void this.stop('completed')
        }, AUTO_STEREO_DURATION_SECONDS * 1_000)
      } catch (error) {
        await this.fail(error)
      }
    })

  startMeter = (): Promise<MeterStartResult> =>
    this.enqueue(async () => {
      await this.performStop('replaced')
      this.update({
        status: 'starting',
        activeTool: 'meter',
        stopReason: null,
        errorMessage: null,
        elapsedSeconds: 0,
        durationSeconds: null,
        meter: createEmptyMeterStats(),
      })

      try {
        this.ensureSystemListeners()
        let permission = await AudioManager.checkRecordingPermissions()
        if (permission === 'Undetermined') {
          permission = await AudioManager.requestRecordingPermissions()
        }
        this.update({ microphonePermission: permission })
        trackEvent(AnalyticsAppEvents.MICROPHONE_PERMISSION_RESULT, {
          result: permission.toLowerCase(),
        })

        if (permission !== 'Granted') {
          this.update({ status: 'idle', activeTool: null })
          return { permission, started: false }
        }

        AudioManager.setAudioSessionOptions({
          iosCategory: 'record',
          iosMode: 'measurement',
          iosOptions: [],
          iosNotifyOthersOnDeactivation: true,
        })
        AudioManager.observeAudioInterruptions(true)
        await AudioManager.setAudioSessionActivity(true)

        const recorder = new AudioRecorder()
        recorder.disableFileOutput()
        recorder.onError(({ message }) => {
          void this.fail(new Error(message))
        })
        recorder.onAudioReady(
          {
            sampleRate: METER_SAMPLE_RATE,
            bufferLength: METER_BUFFER_LENGTH,
            channelCount: 1,
          },
          ({ buffer }) => {
            const samples = buffer.getChannelData(0)
            const estimatedDb = dbfsToEstimatedDb(rmsToDbfs(calculateRms(samples)))
            const previous = this.snapshot.meter
            const currentDb = smoothMeterValue(
              previous.sampleCount === 0 ? null : previous.currentDb,
              estimatedDb
            )
            const sampleCount = previous.sampleCount + 1
            const minimumDb =
              previous.sampleCount === 0 ? currentDb : Math.min(previous.minimumDb, currentDb)
            const maximumDb =
              previous.sampleCount === 0 ? currentDb : Math.max(previous.maximumDb, currentDb)
            const averageDb = (previous.averageDb * previous.sampleCount + currentDb) / sampleCount

            this.update({
              meter: {
                currentDb,
                minimumDb,
                maximumDb,
                averageDb,
                sampleCount,
                band: classifyMeterBand(currentDb),
              },
            })
          }
        )

        const result = await recorder.start()
        if (result.status === 'error') throw new Error(result.message)

        this.recorder = recorder
        this.startedAtMs = Date.now()
        this.update({ status: 'running' })
        trackEvent(AnalyticsAppEvents.AUDIO_TOOL_STARTED, { tool: 'meter', mode: 'fast' })
        this.startTicker()
        return { permission, started: true }
      } catch (error) {
        await this.fail(error)
        return { permission: this.snapshot.microphonePermission, started: false }
      }
    })

  resetMeterStats = () => {
    this.update({ meter: createEmptyMeterStats() })
  }

  stop = (reason: AudioStopReason = 'manual'): Promise<void> =>
    this.enqueue(() => this.performStop(reason))

  private startTicker = (durationSeconds?: number, updateAutoPan = false) => {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = setInterval(() => {
      if (this.startedAtMs === null) return
      const elapsedSeconds = (Date.now() - this.startedAtMs) / 1_000
      const boundedElapsed = durationSeconds
        ? Math.min(elapsedSeconds, durationSeconds)
        : elapsedSeconds
      const patch: Partial<AudioSnapshot> = { elapsedSeconds: boundedElapsed }

      if (updateAutoPan && durationSeconds) {
        const half = durationSeconds / 2
        patch.stereoPan =
          boundedElapsed <= half
            ? -1 + (boundedElapsed / half) * 2
            : 1 - ((boundedElapsed - half) / half) * 2
      }

      this.update(patch)
    }, 100)
  }

  private clearTimers = () => {
    if (this.ticker) clearInterval(this.ticker)
    if (this.completionTimer) clearTimeout(this.completionTimer)
    this.ticker = null
    this.completionTimer = null
    this.startedAtMs = null
  }

  private performStop = async (reason: AudioStopReason) => {
    const hadActiveSession = Boolean(
      this.snapshot.activeTool || this.context || this.recorder || this.oscillator
    )
    if (!hadActiveSession) return

    const endedTool = this.snapshot.activeTool
    const elapsedSeconds = this.snapshot.elapsedSeconds

    this.update({ status: 'stopping' })
    this.clearTimers()

    const context = this.context
    const oscillator = this.oscillator
    const gain = this.gain
    const panner = this.panner
    const recorder = this.recorder

    this.context = null
    this.oscillator = null
    this.gain = null
    this.panner = null
    this.recorder = null

    if (context && gain && context.state === 'running') {
      try {
        const now = context.currentTime
        gain.gain.cancelAndHoldAtTime(now)
        gain.gain.linearRampToValueAtTime(0, now + GAIN_RAMP_SECONDS)
        await wait(GAIN_RAMP_SECONDS * 1_000)
      } catch {
        // Continue cleanup if a platform rejects automation during interruption.
      }
    }

    try {
      oscillator?.stop()
    } catch {
      // Already-stopped sources are safe to ignore during cleanup.
    }
    oscillator?.disconnect()
    gain?.disconnect()
    panner?.disconnect()

    if (recorder) {
      recorder.clearOnAudioReady()
      recorder.clearOnError()
      if (recorder.isRecording()) await recorder.stop()
    }
    if (context && context.state !== 'closed') await context.close()

    try {
      await AudioManager.setAudioSessionActivity(false)
    } catch {
      // The OS may already have deactivated an interrupted session.
    }
    AudioManager.observeAudioInterruptions(null)

    this.update({
      status: 'idle',
      activeTool: null,
      lastTool: endedTool,
      stopReason: reason,
      stereoMode: null,
    })

    if (endedTool) {
      trackEvent(AnalyticsAppEvents.AUDIO_TOOL_ENDED, {
        tool: endedTool,
        stop_reason: reason,
        duration_bucket: getDurationBucket(elapsedSeconds),
      })
    }
  }

  private fail = async (error: unknown) => {
    const message = getErrorMessage(error)
    await this.performStop('error')
    this.update({
      status: 'error',
      activeTool: null,
      stopReason: 'error',
      errorMessage: message,
    })
  }
}

export const audioController = new AudioController()
