import {
  Card,
  NativeMenu,
  type NativeMenuAction,
  NativeToggle,
  Text,
} from '@shared/core/components/base'
import { CaretDownIcon } from 'phosphor-react-native'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, View } from 'react-native'

import {
  formatFilmingTime,
  FPS_OPTIONS,
  type RecordingSettings,
  RESOLUTION_LABELS,
  RESOLUTION_OPTIONS,
} from '@/services/camera/types'
import type { CaptureController } from '@/services/camera/useRecorder'
import { useCameraState } from '@/stores/features/camera'
import { useProjectsState } from '@/stores/features/projects'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { CameraOptionSegmentedControl } from './CameraOptionControls'

interface OptionRowProps {
  label: string
  value: string
  divider?: boolean
}

interface MenuOptionRowProps extends OptionRowProps {
  actions: readonly NativeMenuAction[]
  onSelect: (id: string) => void
  subtitle?: string
}

function MenuOptionRow({ label, value, actions, onSelect, divider, subtitle }: MenuOptionRowProps) {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.optionRow}>
      <View style={styles.optionText}>
        <Text variant="subtitle" weight="medium">
          {label}
        </Text>
        {subtitle && (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
      <NativeMenu actions={actions} onSelect={onSelect} title={label} style={styles.menu}>
        <View style={styles.optionValue}>
          <Text
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value}`}
            tone="secondary"
            numberOfLines={1}
            style={styles.optionValueText}>
            {value}
          </Text>
          <CaretDownIcon size={iconSizes.sm} color={theme.colors.text.muted} />
        </View>
      </NativeMenu>
      {divider && <View pointerEvents="none" style={styles.divider} />}
    </View>
  )
}

function ReadOnlyOptionRow({ label, value, divider }: OptionRowProps) {
  const styles = useThemedStyles(createStyles)

  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.optionRow}>
      <Text variant="subtitle" weight="medium">
        {label}
      </Text>
      <Text tone="secondary" numberOfLines={1} style={styles.optionValueText}>
        {value}
      </Text>
      {divider && <View pointerEvents="none" style={styles.divider} />}
    </View>
  )
}

function ControlRow({
  label,
  children,
  divider,
}: Pick<OptionRowProps, 'label' | 'divider'> & { children: ReactNode }) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.controlRow}>
      <Text variant="subtitle" weight="medium">
        {label}
      </Text>
      {children}
      {divider && <View pointerEvents="none" style={styles.divider} />}
    </View>
  )
}

function ToggleRow({
  label,
  subtitle,
  value,
  onValueChange,
  disabled,
  divider,
}: {
  label: string
  subtitle?: string
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  divider?: boolean
}) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.optionRow}>
      <View style={styles.optionText}>
        <Text variant="subtitle" weight="medium">
          {label}
        </Text>
        {subtitle && (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.toggleControl}>
        <NativeToggle value={value} onValueChange={onValueChange} disabled={disabled} />
      </View>
      {divider && <View pointerEvents="none" style={styles.divider} />}
    </View>
  )
}

function DescriptionRow({ label, body }: { label: string; body: string }) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.optionRow}>
      <View style={styles.optionText}>
        <Text variant="subtitle" weight="medium">
          {label}
        </Text>
        <Text variant="caption" tone="muted">
          {body}
        </Text>
      </View>
    </View>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.section}>
      <Text variant="subtitle" weight="semibold" tone="accent" style={styles.sectionLabel}>
        {label}
      </Text>
      {children}
    </View>
  )
}

export function CameraSettingsSections({ recorder }: { recorder: CaptureController }) {
  const { t } = useTranslation()
  const {
    sharedSettings,
    videoSettings,
    updateSharedSettings,
    updateVideoSettings,
    autoSaveToLibrary,
    setAutoSaveToLibrary,
    phase,
  } = useCameraState()
  const settings = useMemo(
    () => ({ ...sharedSettings, ...videoSettings }),
    [sharedSettings, videoSettings]
  )
  const { projects, selectedProjectId, selectProject } = useProjectsState()
  const styles = useThemedStyles(createStyles)
  const { checkSettings } = recorder
  const [supported, setSupported] = useState<Record<string, boolean>>({})

  useEffect(() => {
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
  }, [settings, checkSettings])

  const changeMode = (mode: RecordingSettings['mode']) => {
    const androidDual = Platform.OS === 'android' && mode === 'dual'
    const deviceId = mode === 'dual' && settings.front ? null : settings.deviceId
    updateSharedSettings({ mode, front: false, deviceId, pairIndex: 0 })
    if (androidDual) updateVideoSettings({ fps: 30, hdr: false, stabilization: false })
  }

  const lensLabel = (device: (typeof recorder.devices)[number]) =>
    device.type === 'ultra-wide-angle'
      ? t('camera.ultraWide')
      : device.type === 'telephoto'
        ? t('camera.telephoto')
        : device.position === 'front'
          ? t('camera.selfie')
          : t('camera.wide')

  const pairLabel = (pair: (typeof recorder.pairs)[number], index: number) =>
    `${t('camera.pair', { number: index + 1 })} · ${pair.map(lensLabel).join(' / ')}`

  const availableLenses = recorder.devices.filter(
    (device) =>
      device.position === 'back' &&
      ['wide-angle', 'ultra-wide-angle', 'telephoto'].includes(device.type)
  )
  const selectedLens = availableLenses.find((device) => device.id === recorder.device?.id)
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const selectedPair = recorder.pairs[settings.pairIndex]
  const selectedPhotoDevices =
    settings.mode === 'dual' ? selectedPair : recorder.device ? [recorder.device] : []
  const photoHdrSupported =
    selectedPhotoDevices.length > 0 &&
    selectedPhotoDevices.every((device) => device.supportsPhotoHDR)
  const hdrUnavailable = !settings.hdr && supported.hdr === false
  const stabilizationUnavailable = !settings.stabilization && supported.stabilization === false

  return (
    <View style={styles.content}>
      <Section label={t('camera.sections.capture')}>
        <Card padding="none">
          {recorder.pairs.length ? (
            <ControlRow label={t('camera.mode')} divider>
              <CameraOptionSegmentedControl
                value={settings.mode}
                onValueChange={changeMode}
                options={[
                  { value: 'single', label: t('camera.singleLens') },
                  { value: 'dual', label: t('camera.dualLens') },
                ]}
                style={styles.segmentedControl}
              />
            </ControlRow>
          ) : (
            <ReadOnlyOptionRow label={t('camera.mode')} value={t('camera.singleLens')} divider />
          )}

          {settings.mode === 'single' &&
            (settings.front ? (
              <ReadOnlyOptionRow
                label={t('camera.lens')}
                value={recorder.device ? t('camera.selfie') : '—'}
                divider
              />
            ) : availableLenses.length ? (
              <MenuOptionRow
                label={t('camera.lens')}
                value={selectedLens ? lensLabel(selectedLens) : '—'}
                actions={availableLenses.map((device) => ({
                  id: device.id,
                  label: lensLabel(device),
                  selected: device.id === recorder.device?.id,
                }))}
                onSelect={(deviceId) => updateSharedSettings({ deviceId })}
                divider
              />
            ) : (
              <ReadOnlyOptionRow label={t('camera.lens')} value="—" divider />
            ))}

          {settings.mode === 'dual' && selectedPair && (
            <MenuOptionRow
              label={t('camera.cameraPair')}
              value={pairLabel(selectedPair, settings.pairIndex)}
              actions={recorder.pairs.map((pair, index) => ({
                id: String(index),
                label: pairLabel(pair, index),
                selected: index === settings.pairIndex,
              }))}
              onSelect={(pairIndex) => updateSharedSettings({ pairIndex: Number(pairIndex) })}
              divider
            />
          )}

          {projects.length > 1 && (
            <MenuOptionRow
              label={t('projects.title')}
              value={selectedProject?.name ?? t('projects.default')}
              actions={projects.map((project) => ({
                id: project.id,
                label: project.name ?? t('projects.default'),
                selected: project.id === selectedProjectId,
              }))}
              onSelect={selectProject}
              divider
            />
          )}
          <ToggleRow
            label={t('camera.grid')}
            value={settings.grid}
            onValueChange={(grid) => updateSharedSettings({ grid })}
            divider
          />
          <ToggleRow
            label={t('camera.mirrorFrontCamera')}
            subtitle={t('camera.mirrorFrontCameraBody')}
            value={sharedSettings.mirrorFrontCamera}
            onValueChange={(mirrorFrontCamera) => updateSharedSettings({ mirrorFrontCamera })}
            disabled={phase !== 'idle'}
            divider
          />
          <ToggleRow
            label={t('camera.autoSaveToLibrary')}
            subtitle={t('camera.autoSaveToLibraryBody')}
            value={autoSaveToLibrary}
            onValueChange={setAutoSaveToLibrary}
            disabled={phase !== 'idle'}
            divider
          />
          <DescriptionRow label={t('camera.storageTitle')} body={t('camera.storageBody')} />
        </Card>
        {settings.mode === 'dual' && Platform.OS === 'android' && (
          <Text variant="caption" tone="muted" style={styles.helperText}>
            {t('camera.androidDualLimits')}
          </Text>
        )}
      </Section>

      <Section label={t('camera.sections.quality')}>
        <Card padding="none">
          <MenuOptionRow
            label={t('camera.resolution')}
            value={RESOLUTION_LABELS[settings.longEdge]}
            actions={RESOLUTION_OPTIONS.map((edge) => ({
              id: String(edge),
              label: RESOLUTION_LABELS[edge],
              disabled: supported[`edge${edge}`] !== true,
              selected: edge === settings.longEdge,
            }))}
            onSelect={(value) =>
              updateSharedSettings({ longEdge: Number(value) as RecordingSettings['longEdge'] })
            }
            subtitle={t('camera.resolutionOutputNote')}
          />
        </Card>
        {settings.longEdge === 2560 && (
          <Text variant="caption" tone="muted" style={styles.helperText}>
            {t('camera.resolution2KNote')}
          </Text>
        )}
      </Section>

      <Section label={t('camera.sections.video')}>
        <Card padding="none">
          <MenuOptionRow
            label={t('camera.fps')}
            value={String(settings.fps)}
            actions={FPS_OPTIONS.map((fps) => ({
              id: String(fps),
              label: String(fps),
              disabled: supported[`fps${fps}`] !== true,
              selected: fps === settings.fps,
            }))}
            onSelect={(value) =>
              updateVideoSettings({ fps: Number(value) as RecordingSettings['fps'] })
            }
            divider
          />
          {recorder.capabilities.mov ? (
            <ControlRow label={t('camera.format')} divider>
              <CameraOptionSegmentedControl
                value={settings.container}
                onValueChange={(container) => updateVideoSettings({ container })}
                options={[
                  { value: 'mp4', label: 'MP4' },
                  { value: 'mov', label: 'MOV' },
                ]}
                style={styles.segmentedControl}
              />
            </ControlRow>
          ) : (
            <ReadOnlyOptionRow label={t('camera.format')} value="MP4" divider />
          )}
          <ToggleRow
            label={t('camera.hdr')}
            subtitle={hdrUnavailable ? t('camera.hdrUnavailable') : undefined}
            value={settings.hdr}
            disabled={!settings.hdr && supported.hdr !== true}
            onValueChange={(hdr) => updateVideoSettings({ hdr })}
            divider
          />
          <ToggleRow
            label={t('camera.stabilization')}
            value={settings.stabilization}
            disabled={!settings.stabilization && supported.stabilization !== true}
            onValueChange={(stabilization) => updateVideoSettings({ stabilization })}
          />
          <View style={styles.storageSummary}>
            <View pointerEvents="none" style={styles.dividerTop} />
            <Text variant="caption" tone="secondary">
              {t('camera.remaining', { time: formatFilmingTime(recorder.remaining) })}
            </Text>
            <Text variant="caption" tone="muted">
              {t('camera.storageRate', {
                amount: ((recorder.bytesPerSecond * 60) / 1e6).toFixed(0),
                free: (recorder.stats.freeBytes / 1e9).toFixed(1),
              })}
            </Text>
          </View>
        </Card>
        {stabilizationUnavailable && (
          <Text variant="caption" tone="muted" style={styles.helperText}>
            {t('camera.stabilizationUnavailable')}
          </Text>
        )}
      </Section>

      <Section label={t('camera.sections.photo')}>
        <Card padding="none">
          <View style={styles.statusRow}>
            <Text variant="subtitle" weight="medium">
              {t('camera.photoHdr')}
            </Text>
            <Text variant="caption" tone="muted">
              {photoHdrSupported ? t('camera.photoHdrAutomatic') : t('camera.photoHdrUnavailable')}
            </Text>
          </View>
        </Card>
      </Section>
    </View>
  )
}

const createStyles = createThemedStyles((theme) => ({
  content: {},
  section: { marginVertical: theme.spacing.xl },
  sectionLabel: {
    marginBottom: theme.spacing.xl,
    textTransform: 'uppercase',
  },
  menu: {
    flexShrink: 1,
    marginStart: 'auto',
  },
  optionRow: {
    position: 'relative',
    minHeight: theme.spacing['5xl'],
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
  },
  optionValue: {
    minWidth: 0,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
  },
  optionValueText: { flexShrink: 1 },
  optionText: { flex: 1, gap: theme.spacing.xs },
  controlRow: {
    position: 'relative',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  toggleControl: { marginStart: 'auto' },
  segmentedControl: { width: '100%' },
  divider: {
    position: 'absolute',
    right: theme.spacing.xl,
    bottom: 0,
    left: theme.spacing.xl,
    height: 1,
    backgroundColor: theme.colors.border.subtle,
  },
  dividerTop: {
    position: 'absolute',
    top: 0,
    right: theme.spacing.xl,
    left: theme.spacing.xl,
    height: 1,
    backgroundColor: theme.colors.border.subtle,
  },
  helperText: { paddingHorizontal: theme.spacing.sm },
  storageSummary: {
    position: 'relative',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  statusRow: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
}))
