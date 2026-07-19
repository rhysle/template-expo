import * as Clipboard from 'expo-clipboard'
import { BugIcon, CaretDownIcon, CaretUpIcon } from 'phosphor-react-native'
import { useRef, useState } from 'react'
import { Platform, type TextStyle, View } from 'react-native'

import { Button, Card, Pressable, Text } from '@/components/base'
import { useSnackbarState } from '@/stores/features/snackbar'
import { useThemeState } from '@/stores/features/theme'
import {
  type ColorScheme,
  createThemedStyles,
  defaultTheme,
  iconSizes,
  useTheme,
  useThemedStyles,
} from '@/theme'

import { ColorPickerControl } from './ColorPickerControl'

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const toHexByte = (value: number) => clampByte(value).toString(16).padStart(2, '0').toUpperCase()

const normalizeColor = (color: string) => {
  const trimmed = color.trim()
  const hexMatch = trimmed.match(/^#([\dA-Fa-f]{6})([\dA-Fa-f]{2})?$/)

  if (hexMatch) {
    const rgb = hexMatch[1].toUpperCase()
    const alpha = hexMatch[2]?.toUpperCase()
    return alpha && alpha !== 'FF' ? `#${rgb}${alpha}` : `#${rgb}`
  }

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i
  )

  if (!rgbaMatch) return trimmed.toUpperCase()

  const red = toHexByte(Number(rgbaMatch[1]))
  const green = toHexByte(Number(rgbaMatch[2]))
  const blue = toHexByte(Number(rgbaMatch[3]))
  const alphaValue = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4])
  const alpha = toHexByte(alphaValue * 255)

  return alpha === 'FF' ? `#${red}${green}${blue}` : `#${red}${green}${blue}${alpha}`
}

const normalizeColorScheme = (colors: ColorScheme): ColorScheme => {
  const result: Record<string, Record<string, string>> = {}
  const colorGroups = colors as unknown as Record<string, Record<string, string>>

  for (const [groupName, group] of Object.entries(colorGroups)) {
    result[groupName] = Object.fromEntries(
      Object.entries(group).map(([tokenName, color]) => [tokenName, normalizeColor(color)])
    )
  }

  return result as unknown as ColorScheme
}

const cloneColorScheme = (colors: ColorScheme) => JSON.parse(JSON.stringify(colors)) as ColorScheme

const formatColorsForSource = (colors: ColorScheme) => {
  const colorGroups = colors as unknown as Record<string, Record<string, string>>
  const groups = Object.entries(colorGroups).map(([groupName, group]) => {
    const tokens = Object.entries(group)
      .map(([tokenName, color]) => `      ${tokenName}: '${normalizeColor(color)}',`)
      .join('\n')

    return `    ${groupName}: {\n${tokens}\n    },`
  })

  return `colors: {\n${groups.join('\n')}\n  }`
}

export const DesignTokenSection = () => {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)
  const { setPreviewColors } = useThemeState()
  const { showSnackbar } = useSnackbarState()
  const [open, setOpen] = useState(false)
  const [draftColors, setDraftColors] = useState(() =>
    normalizeColorScheme(cloneColorScheme(theme.colors))
  )
  const draftColorsRef = useRef(draftColors)
  const effectiveColors = normalizeColorScheme(theme.colors)
  const defaultColors = normalizeColorScheme(defaultTheme.colors)
  const canResetColors =
    JSON.stringify(draftColors) !== JSON.stringify(defaultColors) ||
    JSON.stringify(effectiveColors) !== JSON.stringify(defaultColors)
  const canEditColors = Platform.OS === 'ios'
  const draftColorGroups = draftColors as unknown as Record<string, Record<string, string>>

  const updateColor = (groupName: keyof ColorScheme, tokenName: string, value: string) => {
    const updatedColors = {
      ...draftColorsRef.current,
      [groupName]: {
        ...draftColorsRef.current[groupName],
        [tokenName]: normalizeColor(value),
      },
    } as ColorScheme

    draftColorsRef.current = updatedColors
    setDraftColors(updatedColors)
    setPreviewColors(cloneColorScheme(updatedColors))
  }

  const resetColors = () => {
    const resetColorScheme = cloneColorScheme(defaultColors)
    draftColorsRef.current = resetColorScheme
    setDraftColors(resetColorScheme)
    setPreviewColors(null)
    showSnackbar({ title: 'Colors reset to default', variant: 'success' })
  }

  const copyColors = () => {
    void Clipboard.setStringAsync(formatColorsForSource(draftColors)).then(() => {
      showSnackbar({ title: 'Color object copied', variant: 'success' })
    })
  }

  return (
    <View style={styles.section}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.sectionHeader}>
        <Text variant="subtitle" weight="semibold">
          Design Tokens
        </Text>
        {open ? (
          <CaretUpIcon size={iconSizes.md} color={theme.colors.text.muted} />
        ) : (
          <CaretDownIcon size={iconSizes.md} color={theme.colors.text.muted} />
        )}
      </Pressable>

      {open ? (
        <View style={styles.groups}>
          <TokenGroup title="Colors">
            {!canEditColors ? (
              <Text variant="caption" tone="muted" style={styles.platformNote}>
                Color editing uses the installed iOS system picker and is read-only on this
                platform.
              </Text>
            ) : null}

            {Object.entries(draftColorGroups).map(([groupName, group]) => (
              <View key={groupName} style={styles.colorGroup}>
                <Text variant="caption" weight="semibold" tone="accent">
                  {groupName}
                </Text>
                {Object.entries(group).map(([tokenName, color]) => (
                  <View key={tokenName} style={styles.colorRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                    <View style={styles.colorCopy}>
                      <Text variant="caption" weight="medium">
                        {groupName}.{tokenName}
                      </Text>
                      <Text variant="caption" tone="muted" selectable style={styles.monospace}>
                        {normalizeColor(color)}
                      </Text>
                    </View>
                    <ColorPickerControl
                      value={normalizeColor(color)}
                      onValueChange={(value) =>
                        updateColor(groupName as keyof ColorScheme, tokenName, value)
                      }
                    />
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.colorActions}>
              <Button
                label="Reset colors"
                variant="secondary"
                size="sm"
                fullWidth
                disabled={!canResetColors}
                onPress={resetColors}
                style={styles.colorAction}
              />
              <Button
                label="Copy colors"
                variant="outlined"
                size="sm"
                fullWidth
                onPress={copyColors}
                style={styles.colorAction}
              />
            </View>
          </TokenGroup>

          <TokenGroup title="Typography sizes">
            {Object.entries(theme.typography.sizes).map(([name, size]) => (
              <View key={name} style={styles.previewRow}>
                <Text style={[styles.previewValue, { fontSize: size }]}>Aa</Text>
                <TokenLabel name={name} value={`${size}px`} />
              </View>
            ))}
          </TokenGroup>

          <TokenGroup title="Typography weights">
            {Object.entries(theme.typography.weights).map(([name, weight]) => (
              <View key={name} style={styles.previewRow}>
                <Text
                  style={[
                    styles.weightPreview,
                    {
                      fontFamily:
                        theme.typography.fontFamily[
                          name as keyof typeof theme.typography.fontFamily
                        ],
                      fontWeight: weight as TextStyle['fontWeight'],
                    },
                  ]}>
                  The quick brown fox
                </Text>
                <TokenLabel name={name} value={weight} />
              </View>
            ))}
          </TokenGroup>

          <TokenGroup title="Icon sizes">
            {Object.entries(iconSizes).map(([name, size]) => (
              <View key={name} style={styles.previewRow}>
                <View style={styles.iconPreview}>
                  <BugIcon size={size} color={theme.colors.primary.main} />
                </View>
                <TokenLabel name={name} value={`${size}px`} />
              </View>
            ))}
          </TokenGroup>

          <TokenGroup title="Spacing">
            {Object.entries(theme.spacing).map(([name, size]) => (
              <View key={name} style={styles.previewRow}>
                <View style={[styles.spacingPreview, { width: size }]} />
                <TokenLabel name={name} value={`${size}px`} />
              </View>
            ))}
          </TokenGroup>

          <TokenGroup title="Border radius">
            {Object.entries(theme.borderRadius).map(([name, radius]) => (
              <View key={name} style={styles.previewRow}>
                <View style={[styles.radiusPreview, { borderRadius: radius }]} />
                <TokenLabel name={name} value={`${radius}px`} />
              </View>
            ))}
          </TokenGroup>

          <TokenGroup title="Shadows">
            {Object.entries(theme.shadows).map(([name, shadow]) => (
              <View key={name} style={styles.previewRow}>
                <View style={[styles.shadowPreview, shadow]} />
                <TokenLabel name={name} value="resolved platform style" />
              </View>
            ))}
          </TokenGroup>
        </View>
      ) : null}
    </View>
  )
}

const TokenGroup = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const styles = useThemedStyles(createStyles)

  return (
    <Card padding="md">
      <Text variant="caption" weight="semibold" tone="muted" style={styles.groupTitle}>
        {title}
      </Text>
      <View style={styles.groupContent}>{children}</View>
    </Card>
  )
}

const TokenLabel = ({ name, value }: { name: string; value: string }) => {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.tokenLabel}>
      <Text variant="caption" weight="medium">
        {name}
      </Text>
      <Text variant="caption" tone="muted" style={styles.monospace}>
        {value}
      </Text>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  section: {
    marginBottom: t.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spacing.md,
  },
  groups: {
    gap: t.spacing.md,
  },
  groupTitle: {
    marginBottom: t.spacing.md,
    textTransform: 'uppercase',
  },
  groupContent: {
    gap: t.spacing.md,
  },
  previewRow: {
    minHeight: t.spacing['5xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  previewValue: {
    width: t.spacing['7xl'],
    color: t.colors.text.primary,
  },
  weightPreview: {
    flex: 1,
    color: t.colors.text.primary,
  },
  iconPreview: {
    width: t.spacing['7xl'],
    alignItems: 'center',
  },
  spacingPreview: {
    height: t.spacing.sm,
    maxWidth: t.spacing['9xl'],
    borderRadius: t.borderRadius.full,
    backgroundColor: t.colors.primary.main,
  },
  radiusPreview: {
    width: t.spacing['5xl'] * 2,
    height: t.spacing['5xl'],
    backgroundColor: t.colors.primary.soft,
    borderWidth: 1,
    borderColor: t.colors.primary.main,
  },
  shadowPreview: {
    width: t.spacing['6xl'],
    height: t.spacing['6xl'],
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.background.surface,
  },
  tokenLabel: {
    flex: 1,
    alignItems: 'flex-end',
  },
  monospace: {
    fontFamily: 'monospace',
  },
  platformNote: {
    marginBottom: t.spacing.sm,
  },
  colorGroup: {
    gap: t.spacing.sm,
  },
  colorRow: {
    minHeight: t.spacing['5xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  colorSwatch: {
    width: t.spacing['3xl'],
    height: t.spacing['3xl'],
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.border.default,
  },
  colorCopy: {
    flex: 1,
  },
  colorActions: {
    gap: t.spacing.sm,
    marginTop: t.spacing.md,
  },
  colorAction: {
    flex: 1,
  },
}))
