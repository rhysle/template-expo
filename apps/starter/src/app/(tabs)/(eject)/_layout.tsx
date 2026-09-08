import { useTranslation } from 'react-i18next'

import { TabStack } from '@/components/base'
import { SettingsHeaderButton } from '@/components/SettingsHeaderButton'

export default function EjectTabLayout() {
  const { t } = useTranslation()

  return <TabStack title={t('tabs.eject')} headerRight={() => <SettingsHeaderButton />} />
}
