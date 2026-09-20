import { CapsuleNavigationAccessory } from '@shared/core/components/base'
import { Image } from 'expo-image'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'

import { thumbnailFile } from '@/services/camera/projects'
import { useLatestLibraryMedia } from '@/stores/features/projects'
import { createThemedStyles, useThemedStyles } from '@/theme'

import NativeRecorder from '../../../modules/dual-recorder/src/DualRecorderModule'

export function LatestLibraryPreviewButton({ onOpenFailure }: { onOpenFailure: () => void }) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const media = useLatestLibraryMedia()
  const scale = useSharedValue(1)
  const newestSeenCreatedAt = useRef(media?.createdAt ?? 0)
  const animationReady = useRef(false)
  const receipt = media?.exports.findLast((item) => item.kind === 'portrait')

  useEffect(() => {
    const timeout = setTimeout(() => {
      animationReady.current = true
    }, 700)
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!media || media.createdAt <= newestSeenCreatedAt.current) return
    newestSeenCreatedAt.current = media.createdAt
    if (!animationReady.current) return

    scale.set(
      withSequence(
        withSpring(1.1, {
          damping: 14,
          stiffness: 380,
          mass: 0.7,
          reduceMotion: ReduceMotion.System,
        }),
        withSpring(1, {
          damping: 20,
          stiffness: 340,
          mass: 0.7,
          reduceMotion: ReduceMotion.System,
        })
      )
    )
  }, [media, scale])

  useEffect(() => () => cancelAnimation(scale), [scale])

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  if (!media || !receipt) return null

  return (
    <CapsuleNavigationAccessory
      accessibilityLabel={
        media.mediaType === 'video' ? t('camera.openLatestVideo') : t('camera.openLatestPhoto')
      }
      onPress={() => {
        void NativeRecorder.openPhotoLibrary(receipt.assetId, media.mediaType).catch(onOpenFailure)
      }}>
      <Animated.View style={[styles.imageContainer, animatedStyle]}>
        <Image
          source={{ uri: thumbnailFile(media.id).uri }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={120}
          style={styles.image}
        />
      </Animated.View>
    </CapsuleNavigationAccessory>
  )
}

const createStyles = createThemedStyles(() => ({
  imageContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  image: { width: '100%', height: '100%' },
}))
