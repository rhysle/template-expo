import { Image } from 'react-native'

import { createThemedStyles, useThemedStyles } from '@/theme'

const icon = require('@/assets/images/appIcons/icon.png')

export const PaywallHero = () => {
  const styles = useThemedStyles(createStyles)

  return <Image source={icon} style={styles.image} />
}

const createStyles = createThemedStyles((t) => ({
  image: {
    width: 110,
    height: 110,
    borderRadius: t.borderRadius['2xl'],
  },
}))
