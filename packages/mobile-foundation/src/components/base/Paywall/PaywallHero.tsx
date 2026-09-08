import { createShadows, createThemedStyles, useThemedStyles } from '@rhysle/mobile-foundation/theme'
import { Image } from 'expo-image'
import { View } from 'react-native'

export const PaywallHero = ({ icon }: { icon: import('expo-image').ImageSource }) => {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.shadowContainer}>
      <View style={styles.iconContainer}>
        <Image source={icon} style={styles.image} contentFit="cover" />
      </View>
    </View>
  )
}

const createStyles = createThemedStyles((t) => ({
  shadowContainer: {
    width: 100,
    height: 100,
    borderRadius: t.borderRadius['2xl'],
    backgroundColor: t.colors.background.card,
    borderCurve: 'continuous',
    ...createShadows(t.colors.primary.strong).glow,
  },
  iconContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: t.borderRadius['2xl'],
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: t.borderRadius['2xl'],
  },
}))
