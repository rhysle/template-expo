import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { MediaDetails } from '@/components/projects/MediaDetails'
import { useProjectsState } from '@/stores/features/projects'

export default function ProjectMediaDetailsRoute() {
  const router = useRouter()
  const { mediaId: mediaIdParam } = useLocalSearchParams<{ mediaId: string }>()
  const { media } = useProjectsState()
  const mediaId = Array.isArray(mediaIdParam) ? mediaIdParam[0] : mediaIdParam
  const selectedMedia = media.find((item) => item.id === mediaId)

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      {selectedMedia ? (
        <MediaDetails media={selectedMedia} onClose={() => router.back()} />
      ) : (
        <Redirect href="/projects" />
      )}
    </>
  )
}
