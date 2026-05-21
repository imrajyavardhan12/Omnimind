import { apiFetch } from '@/lib/api/client'
import type { ModelCapability, ModelCatalogEntryResponse, ProviderName } from '@omnimind/types'

export interface ListModelsParams {
  provider?: ProviderName
  capability?: ModelCapability
  enabledOnly?: boolean
}

function toSearchParams(params: ListModelsParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.provider) searchParams.set('provider', params.provider)
  if (params.capability) searchParams.set('capability', params.capability)
  if (params.enabledOnly !== undefined) searchParams.set('enabledOnly', String(params.enabledOnly))

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const modelsApi = {
  list: (params: ListModelsParams, token: string) =>
    apiFetch<{ models: ModelCatalogEntryResponse[] }>(`/v1/models${toSearchParams(params)}`, { token }),
}
