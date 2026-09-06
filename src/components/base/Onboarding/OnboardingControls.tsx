import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { TABLET_CONTENT_MAX_WIDTH } from '@/constants/layout'
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
        label={isLastPage ? t('common.getStarted') : t('common.next')}
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
    maxWidth: TABLET_CONTENT_MAX_WIDTH,
  },
}))
