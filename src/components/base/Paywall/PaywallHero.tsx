import { Image } from 'react-native'

import { createThemedStyles, useThemedStyles } from '@/theme'

const icon = require('@/assets/images/appIcons/ios-icon.png')

export const PaywallHero = () => {
  const styles = useThemedStyles(createStyles)

  return <Image source={icon} style={styles.image} />
}

const createStyles = createThemedStyles((t) => ({
  image: {
    width: 100,
    height: 100,
    borderRadius: t.borderRadius['2xl'],
  },
}))
