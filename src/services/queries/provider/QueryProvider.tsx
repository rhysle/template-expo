import { useReactQueryDevTools } from '@dev-plugins/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { defaultShouldDehydrateQuery, onlineManager, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import * as Network from 'expo-network'
import { ReactNode } from 'react'

import { AppConfig } from '@/configs'
import { queryStorage } from '@/storage'
import { isNetworkOnline } from '@/utils/network'
import { OfflineError } from '@/utils/OfflineError'

const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24

onlineManager.setEventListener((setOnline) => {
  void Network.getNetworkStateAsync()
    .then((state) => setOnline(isNetworkOnline(state)))
    .catch(() => setOnline(true))

  const subscription = Network.addNetworkStateListener((state) => {
    setOnline(isNetworkOnline(state))
  })

  return () => subscription.remove()
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: AppConfig.queryRateStaleTime * 1000,
      retry: (failureCount, error) => {
        if (error instanceof OfflineError) return false
        if (error instanceof Error && /HTTP error! status: 4\d\d/.test(error.message)) return false
        return failureCount < 3
      },
      networkMode: 'online',
      gcTime: QUERY_CACHE_MAX_AGE,
    },
  },
})

export const QUERY_STATE_PERSIST_KEY = 'state'

const persister = createAsyncStoragePersister({
  storage: queryStorage,
  key: QUERY_STATE_PERSIST_KEY,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
})

interface QueryProviderProps {
  children: ReactNode
}

// Filter which queries get dehydrated (serialized) into persistent storage.
// Only queries that pass this filter are written to disk; all others stay memory-only.
const shouldPersistQuery = (query: Parameters<typeof defaultShouldDehydrateQuery>[0]) => {
  if (!defaultShouldDehydrateQuery(query)) return false
  if (query.state.status !== 'success') return false
  // Pass any additional filters here, such as query.queryKey or query.state.data
  return true
}

const ReactQueryDevTools = () => {
  useReactQueryDevTools(queryClient)
  return null
}

export const QueryProvider = ({ children }: QueryProviderProps) => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: 'v1',
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
      }}>
      {__DEV__ && <ReactQueryDevTools />}
      {children}
    </PersistQueryClientProvider>
  )
}
