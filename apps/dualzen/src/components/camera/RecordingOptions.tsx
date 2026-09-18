import { Button, SegmentedControl, Slider, Text } from '@shared/core/components/base'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Platform, ScrollView, Switch, View } from 'react-native'

import {
  formatDuration,
  FPS_OPTIONS,
  type RecordingSettings,
  RESOLUTION_LABELS,
  RESOLUTION_OPTIONS,
} from '@/services/camera/types'
import type { RecorderController } from '@/services/camera/useRecorder'
import { useCameraState } from '@/stores/features/camera'
import { useProjectsState } from '@/stores/features/projects'
import { createThemedStyles, useTheme, useThemedStyles } from '@/theme'

export function RecordingOptions({
  recorder,
  visible,
  onClose,
}: {
  recorder: RecorderController
  visible: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { settings, updateSettings } = useCameraState()
  const { projects, selectedProjectId, selectProject } = useProjectsState()
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const toggleLabels = {
    hdr: t('camera.hdr'),
    stabilization: t('camera.stabilization'),
    grid: t('camera.grid'),
  }
  const { checkSettings } = recorder
  const [supported, setSupported] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setSupported({})
    const variants = [
      ...FPS_OPTIONS.map((fps) => ({ key: `fps${fps}`, settings: { ...settings, fps } })),
      ...RESOLUTION_OPTIONS.map((longEdge) => ({
        key: `edge${longEdge}`,
        settings: { ...settings, longEdge },
      })),
      { key: 'hdr', settings: { ...settings, hdr: true } },
      { key: 'stabilization', settings: { ...settings, stabilization: true } },
    ]
    void Promise.all(
      variants.map(async (variant) => [variant.key, await checkSettings(variant.settings)] as const)
    ).then((values) => {
      if (!cancelled) setSupported(Object.fromEntries(values))
    })
    return () => {
      cancelled = true
    }
  }, [visible, settings, checkSettings])
  const changeMode = (mode: string) => {
    const androidDual = Platform.OS === 'android' && mode === 'dual'
    updateSettings({
      mode: mode as RecordingSettings['mode'],
      front: false,
      deviceId: null,
      pairIndex: 0,
      ...(androidDual ? { fps: 30, hdr: false, stabilization: false } : {}),
    })
  }
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.content}>
          <Text variant="subtitle" weight="bold">
            {t('camera.cameraOptions')}
          </Text>
          <Text tone="secondary">{t('camera.mode')}</Text>
          <SegmentedControl
            value={settings.mode}
            onValueChange={changeMode}
            options={[
              { value: 'single', label: t('camera.singleLens') },
              { value: 'dual', label: t('camera.dualLens'), disabled: !recorder.pairs.length },
            ]}
          />
          {!recorder.pairs.length && (
            <Text variant="caption" tone="muted">
              {t('camera.unsupported')}
            </Text>
          )}
          {settings.mode === 'dual' && recorder.pairs.length > 0 && (
            <SegmentedControl
              value={String(settings.pairIndex)}
              onValueChange={(value) => updateSettings({ pairIndex: Number(value) })}
              options={recorder.pairs.map((pair, index) => ({
                value: String(index),
                label: `${t('camera.pair', { number: index + 1 })} · ${pair.map((item) => (item.type === 'ultra-wide-angle' ? t('camera.ultraWide') : item.type === 'telephoto' ? t('camera.telephoto') : t('camera.wide'))).join(' / ')}`,
              }))}
            />
          )}
          {settings.mode === 'dual' && Platform.OS === 'android' && (
            <Text variant="caption" tone="muted">
              {t('camera.androidDualLimits')}
            </Text>
          )}
          {settings.mode === 'single' && (
            <>
              <Text tone="secondary">{t('camera.lens')}</Text>
              <ScrollView horizontal>
                <SegmentedControl
                  value={recorder.device?.id ?? ''}
                  onValueChange={(deviceId) => updateSettings({ deviceId })}
                  options={recorder.devices
                    .filter(
                      (item) =>
                        item.position === (settings.front ? 'front' : 'back') &&
                        ['wide-angle', 'ultra-wide-angle', 'telephoto', 'true-depth'].includes(
                          item.type
                        )
                    )
                    .map((item) => ({
                      value: item.id,
                      label:
                        item.type === 'ultra-wide-angle'
                          ? t('camera.ultraWide')
                          : item.type === 'telephoto'
                            ? t('camera.telephoto')
                            : item.position === 'front'
                              ? t('camera.selfie')
                              : t('camera.wide'),
                    }))}
                />
              </ScrollView>
              <Text variant="caption" tone="muted">
                {t('camera.digitalZoom')}
              </Text>
            </>
          )}
          <Text tone="secondary">{t('camera.resolution')}</Text>
          <SegmentedControl
            value={String(settings.longEdge)}
            onValueChange={(value) =>
              updateSettings({ longEdge: Number(value) as RecordingSettings['longEdge'] })
            }
            options={RESOLUTION_OPTIONS.map((edge) => ({
              value: String(edge),
              label: RESOLUTION_LABELS[edge],
              disabled: !supported[`edge${edge}`],
            }))}
          />
          <Text variant="caption" tone="muted">
            {t('camera.resolutionNote')}
          </Text>
          <Text tone="secondary">{t('camera.fps')}</Text>
          <SegmentedControl
            value={String(settings.fps)}
            onValueChange={(value) =>
              updateSettings({ fps: Number(value) as RecordingSettings['fps'] })
            }
            options={FPS_OPTIONS.map((fps) => ({
              value: String(fps),
              label: String(fps),
              disabled: !supported[`fps${fps}`],
            }))}
          />
          <Text variant="caption" tone="muted">
            {t('camera.unsupported')}
          </Text>
          <Text tone="secondary">{t('camera.format')}</Text>
          <SegmentedControl
            value={settings.container}
            onValueChange={(container) =>
              updateSettings({ container: container as RecordingSettings['container'] })
            }
            options={[
              { value: 'mp4', label: 'MP4' },
              { value: 'mov', label: 'MOV', disabled: !recorder.capabilities.mov },
            ]}
          />
          {!recorder.capabilities.mov && (
            <Text variant="caption" tone="muted">
              {t('camera.movUnavailable')}
            </Text>
          )}
          {(['hdr', 'stabilization', 'grid'] as const).map((key) => (
            <View key={key} style={styles.row}>
              <Text>{toggleLabels[key]}</Text>
              <Switch
                accessibilityLabel={toggleLabels[key]}
                value={settings[key]}
                disabled={key !== 'grid' && !settings[key] && !supported[key]}
                onValueChange={(value) => updateSettings({ [key]: value })}
                trackColor={{
                  true: theme.colors.primary.main,
                  false: theme.colors.background.subtle,
                }}
              />
            </View>
          ))}
          {!recorder.capabilities.hdr && (
            <Text variant="caption" tone="muted">
              {t('camera.hdrUnavailable')}
            </Text>
          )}
          {(['portrait', 'landscape'] as const).map((kind, index) => (
            <View key={kind} style={styles.framing}>
              <View style={styles.row}>
                <Text>{t('camera.crop', { kind: t(`camera.${kind}`) })}</Text>
                <Text variant="caption" tone="muted">
                  {recorder.sizes[index]
                    ? `${recorder.sizes[index]!.width}×${recorder.sizes[index]!.height}`
                    : '—'}
                </Text>
              </View>
              <Slider
                accessibilityLabel={t('camera.crop', { kind: t(`camera.${kind}`) })}
                value={kind === 'portrait' ? settings.portraitPosition : settings.landscapePosition}
                onValueChange={(value) =>
                  updateSettings(
                    kind === 'portrait' ? { portraitPosition: value } : { landscapePosition: value }
                  )
                }
              />
            </View>
          ))}
          {projects.length > 1 && (
            <>
              <Text tone="secondary">{t('projects.title')}</Text>
              <ScrollView horizontal>
                <SegmentedControl
                  value={selectedProjectId}
                  onValueChange={selectProject}
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name ?? t('projects.default'),
                  }))}
                />
              </ScrollView>
            </>
          )}
          <Text variant="caption" tone="muted">
            {t('camera.remaining', { time: formatDuration(recorder.remaining) })}
          </Text>
          <Text variant="caption" tone="muted">
            {t('camera.storageRate', {
              amount: ((recorder.bytesPerSecond * 60) / 1e6).toFixed(0),
              free: (recorder.stats.freeBytes / 1e9).toFixed(1),
            })}
          </Text>
          <Button onPress={onClose} label={t('camera.done')} />
        </ScrollView>
      </View>
    </Modal>
  )
}
const createStyles = createThemedStyles((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background.overlay,
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius['2xl'],
  },
  content: { padding: theme.spacing.xl, gap: theme.spacing.lg },
  framing: { gap: theme.spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
}))
