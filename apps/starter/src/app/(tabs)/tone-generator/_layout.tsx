import { TabStack } from '@rhysle/core/components/base'
import { useTranslation } from 'react-i18next'

import { SettingsHeaderButton } from '@/components/SettingsHeaderButton'

export default function ToneGeneratorTabLayout() {
  const { t } = useTranslation()

  return <TabStack title={t('tabs.toneGenerator')} headerRight={() => <SettingsHeaderButton />} />
}
