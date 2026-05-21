'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { modelsApi, type ListModelsParams } from '../api/modelsApi'
import { modelCatalogEntriesToModels } from '../lib/modelCatalogAdapter'

export const modelKeys = {
  all: ['models'] as const,
  list: (params: ListModelsParams = {}) => [...modelKeys.all, 'list', params] as const,
}

export function useModels(params: ListModelsParams = {}) {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: modelKeys.list(params),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const { models } = await modelsApi.list(params, token)
      return models
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useAvailableModels(params: ListModelsParams = {}) {
  const query = useModels(params)
  const models = useMemo(() => modelCatalogEntriesToModels(query.data), [query.data])

  return {
    ...query,
    models,
  }
}
