import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
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
import { VolumeManager } from 'react-native-volume-manager'

import {
  addCleaningActivity,
  addDbActivity,
  appendMeterTimelinePoint,
  MIN_DB_SESSION_DURATION_SECONDS,
} from '@/services/activity'
import { AnalyticsAppEvents, trackEvent } from '@/services/firebase/analytics'

import {
  calculateRms,
  classifyMeterBand,
  dbfsToEstimatedDb,
  EJECT_AUDIO_PROFILES,
  EJECT_ROUTINES,
  EJECT_TURBO_STEPS,
  EJECT_WAVEFORM_TYPE,
  getEjectPhase,
  getEjectScheduleWindows,
  rmsToDbfs,
  smoothMeterValue,
} from './audioMath'
import type {
  AudioSnapshot,
  AudioStartResult,
  AudioStopReason,
  EjectRoutineId,
  EjectStartConfig,
  MeterStartResult,
  MeterStats,
  MeterTimelinePoint,
  OutputRouteKind,
  ToneWaveform,
} from './types'

const EJECT_GAIN = 0.82
const TOOL_GAIN = 0.35
const GAIN_RAMP_SECONDS = 0.045
const METER_SAMPLE_RATE = 16_000
const METER_BUFFER_LENGTH = 3_200
const METER_TIMELINE_INTERVAL_MS = 200
const AUTO_STEREO_DURATION_SECONDS = 8
const TOOL_SYSTEM_VOLUME = 0.5
const EJECT_SYSTEM_VOLUME = 0.65
const EJECT_SCHEDULE_LEAD_SECONDS = 0.02

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
  ejectPhase: null,
  ejectRoutineId: null,
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
  private ejectHarmonicOscillator: OscillatorNode | null = null
  private gain: GainNode | null = null
  private ejectHarmonicGain: GainNode | null = null
  private panner: StereoPannerNode | null = null
  private recorder: AudioRecorder | null = null
  private ticker: ReturnType<typeof setInterval> | null = null
  private completionTimer: ReturnType<typeof setTimeout> | null = null
  private ejectScheduleTimer: ReturnType<typeof setTimeout> | null = null
  private startedAtMs: number | null = null
  private interruptionSubscription: AudioEventSubscription | null = null
  private routeSubscription: AudioEventSubscription | null = null
  private systemListenersReady = false
  private meterStartedAtMs: number | null = null
  private lastMeterTimelineSampleIndex = -1
  private meterTimeline: readonly MeterTimelinePoint[] = []

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

  private preparePlayback = async (minimumSystemVolume = TOOL_SYSTEM_VOLUME) => {
    this.ensureSystemListeners()
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: [],
      iosNotifyOthersOnDeactivation: true,
    })
    AudioManager.observeAudioInterruptions('gainTransient')
    await AudioManager.setAudioSessionActivity(true)
    if (Platform.OS !== 'web') {
      const { volume } = await VolumeManager.getVolume()
      if (volume < minimumSystemVolume) {
        await VolumeManager.setVolume(minimumSystemVolume, {
          type: 'music',
          showUI: true,
          playSound: false,
        })
      }
    }
    await this.refreshOutputRoute()
  }

  private createEjectGraph = async (routineId: EjectRoutineId) => {
    const context = new AudioContext()
    await context.resume()
    const oscillator = context.createOscillator()
    const harmonicOscillator = context.createOscillator()
    const gain = context.createGain()
    const harmonicGain = context.createGain()
    const panner = context.createStereoPanner()

    oscillator.type = EJECT_WAVEFORM_TYPE
    harmonicOscillator.type = routineId === 'turbo' ? 'triangle' : EJECT_WAVEFORM_TYPE
    oscillator.frequency.value = 165
    harmonicOscillator.frequency.value = 660
    gain.gain.value = 0
    harmonicGain.gain.value = 0
    panner.pan.value = 0
    oscillator.connect(gain)
    harmonicOscillator.connect(harmonicGain)
    gain.connect(panner)
    harmonicGain.connect(panner)
    panner.connect(context.destination)

    this.context = context
    this.oscillator = oscillator
    this.ejectHarmonicOscillator = harmonicOscillator
    this.gain = gain
    this.ejectHarmonicGain = harmonicGain
    this.panner = panner
    return { context, oscillator, harmonicOscillator, gain, harmonicGain }
  }

  private scheduleTurboEjectSession = (
    oscillator: OscillatorNode,
    harmonicOscillator: OscillatorNode,
    gain: GainNode,
    harmonicGain: GainNode,
    startTime: number,
    durationSeconds: number
  ) => {
    let stageStart = startTime

    for (const [index, step] of EJECT_TURBO_STEPS.entries()) {
      const isLastStep = index === EJECT_TURBO_STEPS.length - 1
      const stageDuration = durationSeconds * step.durationWeight
      const stageEnd = isLastStep ? startTime + durationSeconds : stageStart + stageDuration
      const peakTime = stageStart + (stageEnd - stageStart) * step.peakAt
      const attackEnd = stageStart + Math.min(0.06, (stageEnd - stageStart) / 2)
      const releaseStart = Math.max(attackEnd, stageEnd - 0.08)

      oscillator.frequency.setValueAtTime(step.startHz, stageStart)
      oscillator.frequency.linearRampToValueAtTime(step.peakHz, peakTime)
      oscillator.frequency.linearRampToValueAtTime(step.endHz, stageEnd)

      harmonicOscillator.frequency.setValueAtTime(step.startHz * step.harmonicRatio, stageStart)
      harmonicOscillator.frequency.linearRampToValueAtTime(
        step.peakHz * step.harmonicRatio,
        peakTime
      )
      harmonicOscillator.frequency.linearRampToValueAtTime(
        step.endHz * step.harmonicRatio,
        stageEnd
      )

      gain.gain.setValueAtTime(0, stageStart)
      gain.gain.linearRampToValueAtTime(EJECT_GAIN * step.gainScale, attackEnd)
      gain.gain.setValueAtTime(EJECT_GAIN * step.gainScale, releaseStart)
      gain.gain.linearRampToValueAtTime(0, stageEnd)

      harmonicGain.gain.setValueAtTime(0, stageStart)
      harmonicGain.gain.linearRampToValueAtTime(EJECT_GAIN * step.harmonicGainScale, attackEnd)
      harmonicGain.gain.setValueAtTime(EJECT_GAIN * step.harmonicGainScale, releaseStart)
      harmonicGain.gain.linearRampToValueAtTime(0, stageEnd)

      stageStart = stageEnd
    }
  }

  private scheduleEjectWindow = (
    oscillator: OscillatorNode,
    harmonicOscillator: OscillatorNode,
    gain: GainNode,
    harmonicGain: GainNode,
    startTime: number,
    startOffsetSeconds: number,
    endOffsetSeconds: number,
    routineId: EjectRoutineId
  ) => {
    const windowEnd = startTime + endOffsetSeconds
    const phaseDurations = EJECT_ROUTINES[routineId]
    const profile = EJECT_AUDIO_PROFILES[routineId]
    const harmonic = profile.harmonic
    const cycleDuration = phaseDurations.water + phaseDurations.debris + phaseDurations.finish

    const scheduleEnvelope = (
      gain: GainNode,
      phaseStart: number,
      phaseEnd: number,
      peak: number
    ) => {
      const duration = phaseEnd - phaseStart
      const attackEnd = phaseStart + Math.min(0.06, duration / 2)
      const releaseStart = Math.max(attackEnd, phaseEnd - 0.08)
      gain.gain.setValueAtTime(0, phaseStart)
      gain.gain.linearRampToValueAtTime(peak, attackEnd)
      gain.gain.setValueAtTime(peak, releaseStart)
      gain.gain.linearRampToValueAtTime(0, phaseEnd)
    }

    const scheduleWater = (phaseStart: number, phaseEnd: number) => {
      const duration = phaseEnd - phaseStart
      oscillator.frequency.setValueAtTime(profile.water.startHz, phaseStart)
      oscillator.frequency.linearRampToValueAtTime(
        profile.water.peakHz,
        phaseStart + duration * profile.water.peakAt
      )
      oscillator.frequency.linearRampToValueAtTime(profile.water.endHz, phaseEnd)
      scheduleEnvelope(gain, phaseStart, phaseEnd, EJECT_GAIN * profile.water.gainScale)
      if (harmonic) {
        harmonicOscillator.frequency.setValueAtTime(
          profile.water.startHz * harmonic.ratio,
          phaseStart
        )
        harmonicOscillator.frequency.linearRampToValueAtTime(
          profile.water.peakHz * harmonic.ratio,
          phaseStart + duration * profile.water.peakAt
        )
        harmonicOscillator.frequency.linearRampToValueAtTime(
          profile.water.endHz * harmonic.ratio,
          phaseEnd
        )
        scheduleEnvelope(harmonicGain, phaseStart, phaseEnd, EJECT_GAIN * harmonic.waterGainScale)
      }
    }

    const scheduleDebris = (phaseStart: number, phaseEnd: number) => {
      let pulseIndex = 0
      for (
        let pulseStart = phaseStart;
        pulseStart < phaseEnd;
        pulseStart += profile.debris.pulseSeconds
      ) {
        const pulseEnd = Math.min(pulseStart + profile.debris.pulseSeconds, phaseEnd)
        const activeEnd = Math.max(pulseStart, pulseEnd - 0.14)
        const pulseFrequency = pulseIndex % 2 === 0 ? profile.debris.lowHz : profile.debris.highHz
        oscillator.frequency.setValueAtTime(pulseFrequency, pulseStart)
        scheduleEnvelope(gain, pulseStart, activeEnd, EJECT_GAIN * profile.debris.gainScale)
        if (harmonic) {
          harmonicOscillator.frequency.setValueAtTime(pulseFrequency * harmonic.ratio, pulseStart)
          scheduleEnvelope(
            harmonicGain,
            pulseStart,
            activeEnd,
            EJECT_GAIN * harmonic.debrisGainScale
          )
        }
        pulseIndex += 1
      }
    }

    const scheduleFinish = (phaseStart: number, phaseEnd: number) => {
      const duration = phaseEnd - phaseStart
      oscillator.frequency.setValueAtTime(profile.finish.startHz, phaseStart)
      oscillator.frequency.linearRampToValueAtTime(
        profile.finish.peakHz,
        phaseStart + duration * 0.5
      )
      oscillator.frequency.linearRampToValueAtTime(profile.finish.endHz, phaseEnd)
      scheduleEnvelope(gain, phaseStart, phaseEnd, EJECT_GAIN * profile.finish.gainScale)
      if (harmonic) {
        harmonicOscillator.frequency.setValueAtTime(
          profile.finish.startHz * harmonic.ratio,
          phaseStart
        )
        harmonicOscillator.frequency.linearRampToValueAtTime(
          profile.finish.peakHz * harmonic.ratio,
          phaseStart + duration * 0.5
        )
        harmonicOscillator.frequency.linearRampToValueAtTime(
          profile.finish.endHz * harmonic.ratio,
          phaseEnd
        )
        scheduleEnvelope(harmonicGain, phaseStart, phaseEnd, EJECT_GAIN * harmonic.finishGainScale)
      }
    }

    for (
      let cycleOffset = startOffsetSeconds;
      cycleOffset < endOffsetSeconds;
      cycleOffset += cycleDuration
    ) {
      const waterStart = startTime + cycleOffset
      const waterEnd = Math.min(waterStart + phaseDurations.water, windowEnd)
      if (waterStart < waterEnd) scheduleWater(waterStart, waterEnd)

      const debrisStart = waterStart + phaseDurations.water
      const debrisEnd = Math.min(debrisStart + phaseDurations.debris, windowEnd)
      if (debrisStart < debrisEnd) scheduleDebris(debrisStart, debrisEnd)

      const finishStart = debrisStart + phaseDurations.debris
      const finishEnd = Math.min(finishStart + phaseDurations.finish, windowEnd)
      if (finishStart < finishEnd) scheduleFinish(finishStart, finishEnd)
    }
  }

  private scheduleEjectSession = (
    context: AudioContext,
    oscillator: OscillatorNode,
    harmonicOscillator: OscillatorNode,
    gain: GainNode,
    harmonicGain: GainNode,
    startTime: number,
    durationSeconds: number,
    routineId: EjectRoutineId
  ) => {
    if (routineId === 'turbo') {
      this.scheduleTurboEjectSession(
        oscillator,
        harmonicOscillator,
        gain,
        harmonicGain,
        startTime,
        durationSeconds
      )
      return
    }

    const windows = getEjectScheduleWindows(durationSeconds, routineId)
    const initialWindow = windows[0]
    if (!initialWindow) return

    this.scheduleEjectWindow(
      oscillator,
      harmonicOscillator,
      gain,
      harmonicGain,
      startTime,
      initialWindow.startSeconds,
      initialWindow.endSeconds,
      routineId
    )

    let nextWindowIndex = 1

    const scheduleTimer = () => {
      const nextWindow = windows[nextWindowIndex]
      if (!nextWindow) {
        this.ejectScheduleTimer = null
        return
      }

      const delayMilliseconds = Math.max(
        0,
        (startTime + nextWindow.scheduleAtSeconds - context.currentTime) * 1_000
      )
      this.ejectScheduleTimer = setTimeout(scheduleNextWindow, delayMilliseconds)
    }

    const scheduleNextWindow = () => {
      const window = windows[nextWindowIndex]
      if (
        !window ||
        this.snapshot.activeTool !== 'eject' ||
        this.context !== context ||
        this.oscillator !== oscillator ||
        this.ejectHarmonicOscillator !== harmonicOscillator ||
        this.gain !== gain ||
        this.ejectHarmonicGain !== harmonicGain
      ) {
        this.ejectScheduleTimer = null
        return
      }

      this.scheduleEjectWindow(
        oscillator,
        harmonicOscillator,
        gain,
        harmonicGain,
        startTime,
        window.startSeconds,
        window.endSeconds,
        routineId
      )
      nextWindowIndex += 1
      scheduleTimer()
    }

    scheduleTimer()
  }

  private createPlaybackGraph = async (
    frequencyHz: number,
    gainValue: number,
    pan = 0,
    waveform: ToneWaveform = 'sine'
  ) => {
    const context = new AudioContext()
    await context.resume()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const panner = context.createStereoPanner()

    oscillator.type = waveform
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

  startEject = ({ durationSeconds, routineId }: EjectStartConfig): Promise<AudioStartResult> =>
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
        ejectPhase: 'water',
        ejectRoutineId: routineId,
        stereoMode: null,
      })

      try {
        await this.preparePlayback(EJECT_SYSTEM_VOLUME)
        const { context, oscillator, harmonicOscillator, gain, harmonicGain } =
          await this.createEjectGraph(routineId)
        const startTime = context.currentTime + EJECT_SCHEDULE_LEAD_SECONDS
        this.scheduleEjectSession(
          context,
          oscillator,
          harmonicOscillator,
          gain,
          harmonicGain,
          startTime,
          durationSeconds,
          routineId
        )
        oscillator.start(startTime)
        harmonicOscillator.start(startTime)

        const startedAtMs = Date.now()
        this.startedAtMs = startedAtMs
        this.update({ status: 'running' })
        trackEvent(AnalyticsAppEvents.AUDIO_TOOL_STARTED, {
          tool: 'eject',
          mode: routineId,
          duration_s: durationSeconds,
        })
        this.startTicker(durationSeconds)
        this.completionTimer = setTimeout(() => {
          void this.stop('completed')
        }, durationSeconds * 1_000)
        return { started: true, startedAtMs }
      } catch (error) {
        await this.fail(error)
        return { started: false, startedAtMs: null }
      }
    })

  startTone = (frequencyHz: number, waveform: ToneWaveform = 'sine'): Promise<void> =>
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
        ejectRoutineId: null,
        stereoMode: null,
      })

      try {
        await this.refreshOutputRoute()
        if (this.snapshot.outputRouteKind === 'external') {
          throw new Error('Speaker test requires the device speaker')
        }
        await this.preparePlayback()
        await this.createPlaybackGraph(frequencyHz, TOOL_GAIN, 0, waveform)
        this.startedAtMs = Date.now()
        this.update({ status: 'running' })
        trackEvent(AnalyticsAppEvents.AUDIO_TOOL_STARTED, { tool: 'tone', mode: waveform })
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

  setToneWaveform = (waveform: ToneWaveform) => {
    if (this.snapshot.activeTool !== 'tone' || !this.oscillator) return
    this.oscillator.type = waveform
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
        ejectRoutineId: null,
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
        ejectRoutineId: null,
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
        ejectRoutineId: null,
        meter: createEmptyMeterStats(),
      })
      this.lastMeterTimelineSampleIndex = -1
      this.meterStartedAtMs = null
      this.meterTimeline = []

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
            if (this.snapshot.activeTool !== 'meter' || this.snapshot.status !== 'running') return

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
            if (this.meterStartedAtMs !== null) {
              const elapsedMs = Math.max(Date.now() - this.meterStartedAtMs, 0)
              const sampleIndex = Math.floor(elapsedMs / METER_TIMELINE_INTERVAL_MS)
              if (sampleIndex > this.lastMeterTimelineSampleIndex) {
                this.lastMeterTimelineSampleIndex = sampleIndex
                const elapsedSeconds = (sampleIndex * METER_TIMELINE_INTERVAL_MS) / 1_000
                this.meterTimeline = appendMeterTimelinePoint(
                  this.meterTimeline,
                  elapsedSeconds,
                  currentDb
                )
              }
            }

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
        this.meterStartedAtMs = this.startedAtMs
        this.update({ status: 'running' })
        trackEvent(AnalyticsAppEvents.AUDIO_TOOL_STARTED, { tool: 'meter', mode: 'fast' })
        return { permission, started: true }
      } catch (error) {
        await this.fail(error)
        return { permission: this.snapshot.microphonePermission, started: false }
      }
    })

  resetMeterStats = () => {
    this.lastMeterTimelineSampleIndex = -1
    this.meterTimeline = []
    this.update({ meter: createEmptyMeterStats() })
  }

  stop = (reason: AudioStopReason = 'manual'): Promise<void> => {
    const hasActiveSession = Boolean(
      this.snapshot.activeTool || this.context || this.recorder || this.oscillator
    )
    if (hasActiveSession && this.snapshot.status !== 'stopping') {
      this.update({ status: 'stopping' })
    }
    return this.enqueue(() => this.performStop(reason))
  }

  private startTicker = (durationSeconds?: number, updateAutoPan = false) => {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = setInterval(() => {
      if (this.startedAtMs === null) return
      const elapsedSeconds = Math.max((Date.now() - this.startedAtMs) / 1_000, 0)
      const boundedElapsed = durationSeconds
        ? Math.min(elapsedSeconds, durationSeconds)
        : elapsedSeconds
      const patch: Partial<AudioSnapshot> = { elapsedSeconds: boundedElapsed }

      if (this.snapshot.activeTool === 'eject') {
        patch.ejectPhase = getEjectPhase(
          boundedElapsed,
          this.snapshot.ejectRoutineId ?? 'balanced',
          this.snapshot.durationSeconds ?? undefined
        )
      }

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
    if (this.ejectScheduleTimer) clearTimeout(this.ejectScheduleTimer)
    this.ticker = null
    this.completionTimer = null
    this.ejectScheduleTimer = null
    this.startedAtMs = null
  }

  private performStop = async (reason: AudioStopReason) => {
    const hadActiveSession = Boolean(
      this.snapshot.activeTool ||
      this.context ||
      this.recorder ||
      this.oscillator ||
      this.ejectHarmonicOscillator
    )
    if (!hadActiveSession) return

    const endedTool = this.snapshot.activeTool
    const stoppedAtMs = Date.now()
    const measuredElapsedSeconds =
      this.startedAtMs === null
        ? this.snapshot.elapsedSeconds
        : Math.max((stoppedAtMs - this.startedAtMs) / 1_000, 0)
    const elapsedSeconds = this.snapshot.durationSeconds
      ? Math.min(
          Math.max(measuredElapsedSeconds, this.snapshot.elapsedSeconds),
          this.snapshot.durationSeconds
        )
      : Math.max(measuredElapsedSeconds, this.snapshot.elapsedSeconds)
    const endedAtMs =
      this.startedAtMs === null
        ? stoppedAtMs
        : Math.max(stoppedAtMs, this.startedAtMs + elapsedSeconds * 1_000)
    const meterStats = this.snapshot.meter
    const meterTimeline = this.meterTimeline
    const meterStartedAtMs = this.meterStartedAtMs
    const sessionStartedAtMs = this.startedAtMs
    const configuredDurationSeconds = this.snapshot.durationSeconds
    const ejectRoutineId = this.snapshot.ejectRoutineId

    if (this.snapshot.status !== 'stopping') {
      this.update({ status: 'stopping' })
    }
    this.clearTimers()

    const context = this.context
    const oscillator = this.oscillator
    const harmonicOscillator = this.ejectHarmonicOscillator
    const gain = this.gain
    const harmonicGain = this.ejectHarmonicGain
    const panner = this.panner
    const recorder = this.recorder

    this.context = null
    this.oscillator = null
    this.ejectHarmonicOscillator = null
    this.gain = null
    this.ejectHarmonicGain = null
    this.panner = null
    this.recorder = null
    this.meterStartedAtMs = null
    this.lastMeterTimelineSampleIndex = -1
    this.meterTimeline = []

    if (context && gain && context.state === 'running') {
      try {
        const now = context.currentTime
        gain.gain.cancelAndHoldAtTime(now)
        gain.gain.linearRampToValueAtTime(0, now + GAIN_RAMP_SECONDS)
        harmonicGain?.gain.cancelAndHoldAtTime(now)
        harmonicGain?.gain.linearRampToValueAtTime(0, now + GAIN_RAMP_SECONDS)
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
    try {
      harmonicOscillator?.stop()
    } catch {
      // Already-stopped sources are safe to ignore during cleanup.
    }
    oscillator?.disconnect()
    harmonicOscillator?.disconnect()
    gain?.disconnect()
    harmonicGain?.disconnect()
    panner?.disconnect()

    if (recorder) {
      recorder.clearOnError()
      if (recorder.isRecording()) await recorder.stop()
      recorder.clearOnAudioReady()
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
      ejectPhase: null,
      ejectRoutineId: null,
      stereoMode: null,
    })

    if (
      endedTool === 'eject' &&
      sessionStartedAtMs !== null &&
      configuredDurationSeconds !== null &&
      ejectRoutineId !== null
    ) {
      addCleaningActivity({
        id: Crypto.randomUUID(),
        startedAtMs: sessionStartedAtMs,
        endedAtMs,
        configuredDurationSeconds,
        actualDurationSeconds: elapsedSeconds,
        routineId: ejectRoutineId,
        stopReason: reason,
      })
    }

    if (
      endedTool === 'meter' &&
      meterStartedAtMs !== null &&
      elapsedSeconds >= MIN_DB_SESSION_DURATION_SECONDS &&
      meterStats.sampleCount > 0
    ) {
      addDbActivity({
        id: Crypto.randomUUID(),
        startedAtMs: meterStartedAtMs,
        endedAtMs,
        durationSeconds: elapsedSeconds,
        minimumDb: Math.round(meterStats.minimumDb),
        averageDb: Math.round(meterStats.averageDb),
        maximumDb: Math.round(meterStats.maximumDb),
        stopReason: reason,
        timeline: [...meterTimeline],
      })
    }

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
