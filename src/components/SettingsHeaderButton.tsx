import { useRouter } from 'expo-router'
import { GearIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { Pressable } from '@/components/base'
import { iconSizes, useTheme } from '@/theme'

export const SettingsHeaderButton = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const { colors } = useTheme()

  return (
    <Pressable
      accessibilityLabel={t('settings.title')}
      accessibilityRole="button"
      haptic
      hitSlop={8}
      onPress={() => router.push('/settings')}>
      <GearIcon size={iconSizes.lg} color={colors.text.primary} />
    </Pressable>
  )
}
