import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'

import { MediaDetails } from '@/components/projects/MediaDetails'
import { useProjectsState } from '@/stores/features/projects'

export default function ProjectMediaDetailsRoute() {
  const router = useRouter()
  const { mediaId: mediaIdParam } = useLocalSearchParams<{ mediaId: string }>()
  const { media } = useProjectsState()
  const mediaId = Array.isArray(mediaIdParam) ? mediaIdParam[0] : mediaIdParam
  const selectedMedia = media.find((item) => item.id === mediaId)

  useEffect(() => {
    if (!selectedMedia) router.back()
  }, [router, selectedMedia])

  return selectedMedia ? <MediaDetails media={selectedMedia} /> : null
}
