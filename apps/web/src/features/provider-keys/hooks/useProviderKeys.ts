'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { providerKeysApi } from '../api/providerKeysApi'
import type { ProviderName } from '@omnimind/types'

export const providerKeyKeys = {
  all: ['providerKeys'] as const,
  list: () => [...providerKeyKeys.all, 'list'] as const,
}

export function useProviderKeys() {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: providerKeyKeys.list(),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const { providerKeys } = await providerKeysApi.list(token)
      return providerKeys
    },
  })
}

export function useUpsertProviderKey() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ provider, key }: { provider: ProviderName; key: string }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const { providerKey } = await providerKeysApi.upsert(provider, key, token)
      return providerKey
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeyKeys.list() })
    },
  })
}

export function useDeleteProviderKey() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (provider: ProviderName) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return providerKeysApi.remove(provider, token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeyKeys.list() })
    },
  })
}
