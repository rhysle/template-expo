import { TabStack } from '@shared/core/components/base'
import { useTranslation } from 'react-i18next'

export default function ToneGeneratorTabLayout() {
  const { t } = useTranslation()

  return <TabStack title={t('tabs.toneGenerator')} />
}
