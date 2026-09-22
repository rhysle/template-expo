import { CapsuleNavigationAccessory, Text } from '@shared/core/components/base'
import { TrashIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { createThemedStyles, iconSizes, useTheme, useThemedStyles } from '@/theme'

import { ProjectBottomActionBar } from './ProjectBottomActionBar'
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
  const { colors } = useTheme()
  const glass = useProjectGlass()

  return (
    <ProjectBottomActionBar
      center={
        <View style={styles.countShadow}>
          <ProjectGlassSurface {...glass} style={styles.countSurface}>
            <Text numberOfLines={1} weight="semibold" style={styles.tabularNumbers}>
              {t('projects.selected', { count: selectedCount })}
            </Text>
          </ProjectGlassSurface>
        </View>
      }
      trailing={
        selectedCount > 0 ? (
          <CapsuleNavigationAccessory
            accessibilityLabel={t('projects.deleteSelected')}
            disabled={disabled}
            onPress={onDelete}>
            <TrashIcon color={colors.status.error} size={iconSizes.lg} />
          </CapsuleNavigationAccessory>
        ) : undefined
      }
    />
  )
}

const createStyles = createThemedStyles((theme) => ({
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
  tabularNumbers: { fontVariant: ['tabular-nums'] },
}))
