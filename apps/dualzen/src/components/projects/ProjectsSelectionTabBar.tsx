import { CapsuleNavigationAccessory, Text, useSetTabBarHeight } from '@shared/core/components/base'
import { TrashIcon } from 'phosphor-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { ProjectGlassSurface, useProjectGlass } from './ProjectGlassControls'

interface ProjectsSelectionTabBarProps {
  disabled: boolean
  onDelete: () => void
  selectedCount: number
}

export function ProjectsSelectionTabBar({
  disabled,
  onDelete,
  selectedCount,
}: ProjectsSelectionTabBarProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { colors, spacing } = useTheme()
  const glass = useProjectGlass()
  const insets = useSafeAreaInsets()
  const setHeight = useSetTabBarHeight()
  const [measuredHeight, setMeasuredHeight] = useState(0)

  useEffect(() => {
    setHeight(measuredHeight)
    return () => setHeight(0)
  }, [measuredHeight, setHeight])

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: insets.bottom + spacing.sm }]}
      onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}>
      <View pointerEvents="box-none" style={styles.barRow}>
        <View style={styles.countShadow}>
          <ProjectGlassSurface {...glass} style={styles.countSurface}>
            <Text numberOfLines={1} weight="semibold" style={styles.tabularNumbers}>
              {t('projects.selected', { count: selectedCount })}
            </Text>
          </ProjectGlassSurface>
        </View>
        {selectedCount > 0 && (
          <View style={styles.trailingAction}>
            <CapsuleNavigationAccessory
              accessibilityLabel={t('projects.deleteSelected')}
              disabled={disabled}
              onPress={onDelete}>
              <TrashIcon color={colors.status.error} size={iconSizes.lg} />
            </CapsuleNavigationAccessory>
          </View>
        )}
      </View>
    </View>
  )
}

const createStyles = createThemedStyles((theme) => ({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  barRow: {
    width: '100%',
    minHeight: theme.spacing['5xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  countShadow: {
    maxWidth: '60%',
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.md,
  },
  countSurface: {
    minHeight: theme.spacing['5xl'],
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  trailingAction: { position: 'absolute', right: 0 },
  tabularNumbers: { fontVariant: ['tabular-nums'] },
}))
