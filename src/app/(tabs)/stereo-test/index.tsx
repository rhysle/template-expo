import { CheckCircleIcon, HeadphonesIcon } from 'phosphor-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { AudioToolScreen, StereoStage } from '@/components/audio'
import {
  Button,
  ChoiceChip,
  InlineNotice,
  SegmentedControl,
  StatusBadge,
  Text,
} from '@/components/base'
import {
  audioController,
  getAudioResultState,
  useAudioController,
  useAudioToolLifecycle,
} from '@/services/audio'
import { useAudioPreferencesState } from '@/stores/features/audioPreferences'
import { createThemedStyles, useThemedStyles } from '@/theme'

type ScreenMode = 'manual' | 'auto'

export default function StereoTestScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const snapshot = useAudioController()
  const { hapticsEnabled } = useAudioPreferencesState()
  const [mode, setMode] = useState<ScreenMode>('manual')
  useAudioToolLifecycle()

  const isRunning = snapshot.activeTool === 'stereo' && snapshot.status === 'running'
  const isStarting = snapshot.activeTool === 'stereo' && snapshot.status === 'starting'
  const isActive = isRunning || isStarting
  const isLastStereoSession = snapshot.lastTool === 'stereo'
  const resultState = getAudioResultState(isLastStereoSession ? snapshot.stopReason : null)
  const pan = isActive ? snapshot.stereoPan : 0
  const positionLabel = !isActive
    ? t('audioTools.stereo.idlePosition')
    : pan < -0.25
      ? t('audioTools.stereo.positionLeft')
      : pan > 0.25
        ? t('audioTools.stereo.positionRight')
        : t('audioTools.stereo.positionCenter')

  const setScreenMode = (nextMode: ScreenMode) => {
    if (isActive) void audioController.stop('replaced')
    setMode(nextMode)
  }

  const playManual = (nextPan: number) => {
    void audioController.startStereoManual(nextPan)
  }

  return (
    <AudioToolScreen>
      <Text variant="body" tone="secondary" align="center">
        {t('audioTools.stereo.subtitle')}
      </Text>

      <SegmentedControl
        value={mode}
        onValueChange={setScreenMode}
        options={[
          { label: t('audioTools.stereo.manual'), value: 'manual' },
          { label: t('audioTools.stereo.auto'), value: 'auto' },
        ]}
        size="md"
      />

      <StereoStage
        pan={pan}
        active={isRunning}
        leftLabel={t('audioTools.stereo.left')}
        rightLabel={t('audioTools.stereo.right')}
        positionLabel={positionLabel}
      />

      {mode === 'manual' ? (
        <View style={styles.manualControls}>
          {[
            { label: t('audioTools.stereo.left'), pan: -1 },
            { label: t('audioTools.stereo.center'), pan: 0 },
            { label: t('audioTools.stereo.right'), pan: 1 },
          ].map((option) => (
            <ChoiceChip
              key={option.pan}
              label={option.label}
              selected={isActive && Math.abs(snapshot.stereoPan - option.pan) < 0.1}
              haptic={hapticsEnabled}
              style={styles.manualChip}
              onPress={() => playManual(option.pan)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.autoControls}>
          {isActive && snapshot.stereoMode === 'auto' ? (
            <Text variant="body" tone="secondary" align="center">
              {Math.max(Math.ceil(8 - snapshot.elapsedSeconds), 0)}s
            </Text>
          ) : null}
          <Button
            fullWidth
            size="lg"
            haptic={hapticsEnabled}
            loading={isStarting}
            variant={isActive ? 'danger' : 'primary'}
            label={isActive ? t('audioTools.stereo.stop') : t('audioTools.stereo.startAuto')}
            onPress={() => {
              if (isActive) void audioController.stop('manual')
              else void audioController.startStereoAuto()
            }}
          />
        </View>
      )}

      {mode === 'manual' && isActive ? (
        <Button
          fullWidth
          variant="danger"
          label={t('audioTools.stereo.stop')}
          haptic={hapticsEnabled}
          onPress={() => void audioController.stop('manual')}
        />
      ) : null}

      {resultState === 'completed' ? (
        <StatusBadge
          label={t('audioTools.stereo.completed')}
          tone="success"
          icon={CheckCircleIcon}
          style={styles.centerBadge}
        />
      ) : null}
      {resultState === 'interrupted' ? (
        <InlineNotice tone="warning">{t('audioTools.common.interrupted')}</InlineNotice>
      ) : null}
      {snapshot.status === 'error' && isLastStereoSession ? (
        <InlineNotice tone="error">{t('audioTools.common.error')}</InlineNotice>
      ) : null}

      <InlineNotice
        title={t('audioTools.stereo.headphonesTitle')}
        tone="info"
        icon={HeadphonesIcon}>
        {t('audioTools.stereo.headphonesBody')}
      </InlineNotice>
      <InlineNotice compact>{t('audioTools.common.gradualVolume')}</InlineNotice>
    </AudioToolScreen>
  )
}

const createStyles = createThemedStyles((t) => ({
  manualControls: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  manualChip: {
    flex: 1,
    alignSelf: 'stretch',
  },
  autoControls: {
    gap: t.spacing.md,
  },
  centerBadge: {
    alignSelf: 'center',
  },
}))
