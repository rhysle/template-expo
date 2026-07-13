import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { createThemedStyles, useThemedStyles } from '@/theme'

import { Button } from '../Button'

interface OnboardingControlsProps {
  isLastPage: boolean
  onNext: () => void
  onSkip?: () => void
}

export const OnboardingControls = ({ isLastPage, onNext }: OnboardingControlsProps) => {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  return (
    <View style={styles.container}>
      <Button
        variant="primary"
        size="lg"
        haptic
        animationType="darken"
        label={isLastPage ? t('onboarding.done') : t('onboarding.next')}
        onPress={onNext}
        style={styles.button}
      />
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  container: {
    alignItems: 'center',
    paddingHorizontal: t.spacing['2xl'],
    paddingVertical: t.spacing.lg,
  },
  button: {
    width: '70%',
  },
}))
