import type { Icon } from 'phosphor-react-native'
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  InfoIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  ShieldCheckIcon,
  SpeakerHighIcon,
  WarningCircleIcon,
  XCircleIcon,
} from 'phosphor-react-native'
import { useState } from 'react'
import { View } from 'react-native'

import {
  BottomSheet,
  BouncingDotsLoader,
  Button,
  Card,
  ChoiceChip,
  type ComponentTone,
  IconButton,
  InlineNotice,
  ProgressRing,
  PulsingRingLoader,
  SearchInput,
  SegmentedControl,
  SpinArcLoader,
  StatusBadge,
  Text,
  TextField,
  Toggle,
} from '@/components/base'
import type { SegmentedOption } from '@/components/base/SegmentedControl'
import { useSnackbarState } from '@/stores/features/snackbar'
import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

type PlaygroundTab = 'first' | 'second' | 'third'

const TONES: readonly ComponentTone[] = ['neutral', 'accent', 'success', 'warning', 'error', 'info']

const TONE_ICONS: Record<ComponentTone, Icon> = {
  neutral: InfoIcon,
  accent: ShieldCheckIcon,
  success: CheckCircleIcon,
  warning: WarningCircleIcon,
  error: XCircleIcon,
  info: InfoIcon,
}

const TONE_LABELS: Record<ComponentTone, string> = {
  neutral: 'Neutral',
  accent: 'Accent',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  info: 'Information',
}

const PLAYGROUND_TABS: readonly SegmentedOption<PlaygroundTab>[] = [
  { label: 'First', value: 'first' },
  { label: 'Second', value: 'second' },
  { label: 'Third', value: 'third' },
] as const

export const BaseComponentGallery = () => {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const { showSnackbar } = useSnackbarState()
  const [selectedPreset, setSelectedPreset] = useState('440')
  const [fieldValue, setFieldValue] = useState('')
  const [searchValue, setSearchValue] = useState('speaker')
  const [progressValue, setProgressValue] = useState(68)
  const [playgroundTab, setPlaygroundTab] = useState<PlaygroundTab>('first')
  const [toggleEnabled, setToggleEnabled] = useState(false)
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false)

  return (
    <>
      <View style={styles.gallery}>
        <GalleryCard title="Buttons">
          <View style={styles.buttonGallery}>
            <Button variant="primary" label="Primary" fullWidth />
            <Button variant="secondary" label="Secondary" fullWidth />
            <Button variant="ghost" label="Ghost" fullWidth />
            <Button variant="outlined" label="Outlined" fullWidth />
            <Button variant="inverted" label="Inverted" fullWidth />
            <Button variant="danger" label="Danger" fullWidth />
            <Button
              label="With left icon"
              leftIcon={<CheckIcon size={iconSizes.sm} color={colors.text.inverse} />}
              fullWidth
            />
            <Button
              variant="outlined"
              label="With right icon"
              rightIcon={<ArrowRightIcon size={iconSizes.sm} color={colors.primary.main} />}
              fullWidth
            />
            <Button label="Loading" loading fullWidth />
          </View>
        </GalleryCard>

        <GalleryCard title="Icon buttons">
          <View style={styles.wrapRow}>
            <IconButton
              icon={PlayIcon}
              accessibilityLabel="Primary icon button"
              variant="primary"
            />
            <IconButton
              icon={SpeakerHighIcon}
              accessibilityLabel="Secondary icon button"
              variant="secondary"
            />
            <IconButton icon={InfoIcon} accessibilityLabel="Ghost icon button" variant="ghost" />
            <IconButton
              icon={CheckIcon}
              accessibilityLabel="Outlined icon button"
              variant="outlined"
            />
            <IconButton
              icon={XCircleIcon}
              accessibilityLabel="Danger icon button"
              variant="danger"
            />
          </View>
          <View style={styles.wrapRow}>
            <IconButton icon={PlayIcon} accessibilityLabel="Small icon button" size="sm" selected />
            <IconButton icon={PlayIcon} accessibilityLabel="Medium icon button" size="md" />
            <IconButton icon={PlayIcon} accessibilityLabel="Large icon button" size="lg" />
            <IconButton icon={PlayIcon} accessibilityLabel="Extra large icon button" size="xl" />
          </View>
          <View style={styles.wrapRow}>
            <IconButton icon={CheckIcon} accessibilityLabel="Selected icon button" selected />
            <IconButton icon={CheckIcon} accessibilityLabel="Disabled icon button" disabled />
            <IconButton icon={CheckIcon} accessibilityLabel="Loading icon button" loading />
          </View>
        </GalleryCard>

        <GalleryCard title="Status badges">
          <View style={styles.wrapRow}>
            {TONES.map((tone) => (
              <StatusBadge
                key={tone}
                label={TONE_LABELS[tone]}
                tone={tone}
                icon={TONE_ICONS[tone]}
              />
            ))}
            <StatusBadge
              label="A long status label that can wrap at large text sizes"
              tone="accent"
            />
          </View>
        </GalleryCard>

        <GalleryCard title="Choice chips">
          <View style={styles.wrapRow}>
            {['440', '880', '1000'].map((preset) => (
              <ChoiceChip
                key={preset}
                label={`${preset} Hz`}
                selected={selectedPreset === preset}
                onPress={() => setSelectedPreset(preset)}
              />
            ))}
            <ChoiceChip label="Disabled" selected={false} disabled />
            <ChoiceChip
              label="Long preset label that wraps instead of clipping"
              selected={false}
              icon={SpeakerHighIcon}
              onPress={() => {}}
            />
          </View>
        </GalleryCard>

        <GalleryCard title="Inline notices">
          {TONES.map((tone) => (
            <InlineNotice
              key={tone}
              tone={tone}
              title={TONE_LABELS[tone]}
              compact={tone !== 'info'}
              action={
                tone === 'info'
                  ? {
                      label: 'Learn more',
                      onPress: () => {},
                    }
                  : undefined
              }>
              This notice remains readable when the message wraps across multiple lines.
            </InlineNotice>
          ))}
          <InlineNotice icon={null} title="No icon">
            Consumers can suppress the default tone icon when the surrounding context is enough.
          </InlineNotice>
        </GalleryCard>

        <GalleryCard title="Text fields">
          <TextField
            label="Frequency label"
            helperText="Helper text supplied by the consumer"
            placeholder="Enter a value"
            value={fieldValue}
            onChangeText={setFieldValue}
            leading={<MagnifyingGlassIcon size={iconSizes.md} color={colors.text.muted} />}
          />
          <TextField
            label="Validation error"
            errorText="Enter a value between 20 and 20,000"
            defaultValue="30,000"
            keyboardType="numeric"
          />
          <TextField label="Read only" defaultValue="Preset A4" readOnly />
          <TextField label="Disabled" defaultValue="Unavailable" editable={false} />
          <TextField
            label="Multiline"
            helperText="The field grows to a practical minimum editing height."
            multiline
            placeholder="Add notes"
          />
          <SearchInput
            accessibilityLabel="Search component gallery"
            placeholder="Search"
            value={searchValue}
            onChangeText={setSearchValue}
          />
        </GalleryCard>

        <GalleryCard title="Progress rings">
          <View style={styles.progressRow}>
            <ProgressPreview label="Empty">
              <ProgressRing
                value={-20}
                size={96}
                tone="neutral"
                animated={false}
                accessibilityLabel="Empty progress">
                <Text variant="subtitle" weight="bold" selectable>
                  0%
                </Text>
              </ProgressRing>
            </ProgressPreview>

            <ProgressPreview label="Interactive">
              <ProgressRing
                value={progressValue}
                size={120}
                tone="accent"
                accessibilityLabel="Interactive progress"
                accessibilityValueText={`${progressValue} percent`}>
                <IconButton
                  icon={PlayIcon}
                  accessibilityLabel="Toggle progress value"
                  variant="primary"
                  size="md"
                  onPress={() => setProgressValue((current) => (current === 68 ? 32 : 68))}
                />
              </ProgressRing>
              <Text variant="caption" tone="muted" style={styles.tabularNumbers} selectable>
                {progressValue}%
              </Text>
            </ProgressPreview>

            <ProgressPreview label="Complete">
              <ProgressRing
                value={140}
                size={96}
                tone="success"
                animated={false}
                accessibilityLabel="Complete progress">
                <CheckIcon size={iconSizes.lg} color={colors.status.success} weight="bold" />
              </ProgressRing>
            </ProgressPreview>
          </View>
          <Button
            variant="secondary"
            size="sm"
            label="Toggle animated progress"
            onPress={() => setProgressValue((current) => (current === 68 ? 32 : 68))}
          />
        </GalleryCard>

        <GalleryCard title="Loaders">
          <View style={styles.loaderRow}>
            <LoaderPreview label="Bouncing dots">
              <BouncingDotsLoader color={colors.primary.main} />
            </LoaderPreview>
            <LoaderPreview label="Spin arc">
              <SpinArcLoader color={colors.primary.main} size={28} />
            </LoaderPreview>
            <LoaderPreview label="Pulsing ring">
              <PulsingRingLoader color={colors.primary.main} />
            </LoaderPreview>
          </View>
        </GalleryCard>

        <GalleryCard title="Segmented control">
          <SegmentedControl
            options={PLAYGROUND_TABS}
            value={playgroundTab}
            onValueChange={setPlaygroundTab}
          />
          <Text variant="caption" tone="muted">
            Selected: {playgroundTab}
          </Text>
        </GalleryCard>

        <GalleryCard title="Toggle">
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text variant="body" weight="medium">
                Toggle
              </Text>
              <Text variant="caption" tone="muted">
                {toggleEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
            <Toggle value={toggleEnabled} onValueChange={setToggleEnabled} />
          </View>
        </GalleryCard>

        <GalleryCard title="Bottom sheet">
          <Button
            variant="secondary"
            label="Open Bottom Sheet"
            fullWidth
            onPress={() => setIsBottomSheetVisible(true)}
          />
        </GalleryCard>

        <GalleryCard title="Snackbars">
          <View style={styles.actionsGrid}>
            <Button
              variant="secondary"
              size="sm"
              label="Default"
              onPress={() => showSnackbar({ title: 'Hello from snackbar' })}
            />
            <Button
              variant="secondary"
              size="sm"
              label="Success"
              onPress={() => showSnackbar({ title: 'Changes saved', variant: 'success' })}
            />
            <Button
              variant="secondary"
              size="sm"
              label="Success + subtitle"
              onPress={() =>
                showSnackbar({
                  title: 'Changes saved',
                  subtitle: 'Your data has been saved successfully',
                  variant: 'success',
                })
              }
            />
            <Button
              variant="secondary"
              size="sm"
              label="Error"
              onPress={() => showSnackbar({ title: 'Something went wrong', variant: 'error' })}
            />
            <Button
              variant="secondary"
              size="sm"
              label="Warning"
              onPress={() => showSnackbar({ title: 'Connection lost', variant: 'warning' })}
            />
            <Button
              variant="secondary"
              size="sm"
              label="Info"
              onPress={() => showSnackbar({ title: 'A new update is available', variant: 'info' })}
            />
            <Button
              variant="secondary"
              size="sm"
              label="Neutral"
              onPress={() => showSnackbar({ title: 'Currency added', variant: 'neutral' })}
            />
            <Button
              variant="secondary"
              size="sm"
              label="With action"
              onPress={() =>
                showSnackbar({
                  title: 'Currency removed',
                  variant: 'neutral',
                  action: { label: 'Undo', onPress: () => {} },
                })
              }
            />
            <Button
              variant="secondary"
              size="sm"
              label="Persistent (no auto-dismiss)"
              onPress={() =>
                showSnackbar({
                  title: 'Update ready',
                  variant: 'success',
                  durationMs: 0,
                  action: { label: 'Restart', onPress: () => {} },
                })
              }
            />
            <Button
              variant="secondary"
              size="sm"
              label="No icon override"
              onPress={() =>
                showSnackbar({ title: 'Success but no icon', variant: 'success', icon: null })
              }
            />
          </View>
        </GalleryCard>
      </View>

      <BottomSheet visible={isBottomSheetVisible} onDismiss={() => setIsBottomSheetVisible(false)}>
        <View style={styles.bottomSheetContent}>
          <Text variant="title" weight="semibold">
            Bottom Sheet
          </Text>
          <Text variant="body" tone="muted">
            Drag down, tap the backdrop, or use the button below to dismiss this sheet.
          </Text>
          <Button label="Dismiss" fullWidth onPress={() => setIsBottomSheetVisible(false)} />
        </View>
      </BottomSheet>
    </>
  )
}

const GalleryCard = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const styles = useThemedStyles(createStyles)

  return (
    <Card padding="md" style={styles.card}>
      <Text variant="caption" weight="semibold" tone="muted">
        {title}
      </Text>
      {children}
    </Card>
  )
}

const ProgressPreview = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.progressPreview}>
      {children}
      <Text variant="caption" tone="muted" align="center">
        {label}
      </Text>
    </View>
  )
}

const LoaderPreview = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.loaderPreview}>
      <View style={styles.loaderPreviewAnimation}>{children}</View>
      <Text variant="caption" tone="muted" align="center">
        {label}
      </Text>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  gallery: {
    gap: t.spacing.md,
  },
  card: {
    gap: t.spacing.md,
  },
  buttonGallery: {
    gap: t.spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    gap: t.spacing.md,
  },
  progressPreview: {
    minWidth: 120,
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  tabularNumbers: {
    fontVariant: ['tabular-nums'],
  },
  loaderRow: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  loaderPreview: {
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  loaderPreviewAnimation: {
    height: 32,
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleCopy: {
    gap: t.spacing.xs,
  },
  actionsGrid: {
    gap: t.spacing.sm,
  },
  bottomSheetContent: {
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.md,
  },
}))
