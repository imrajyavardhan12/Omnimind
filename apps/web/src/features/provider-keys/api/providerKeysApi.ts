import { apiFetch } from '@/lib/api/client'
import type { ProviderName } from '@omnimind/types'

export interface ProviderKeyDto {
  id: string
  workspaceId: string
  provider: ProviderName
  keyHint: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export const providerKeysApi = {
  list: (token: string) =>
    apiFetch<{ providerKeys: ProviderKeyDto[] }>('/v1/provider-keys', { token }),

  upsert: (provider: ProviderName, key: string, token: string) =>
    apiFetch<{ providerKey: ProviderKeyDto }>(`/v1/provider-keys/${provider}`, {
      method: 'PUT',
      body: JSON.stringify({ key }),
      token,
    }),

  remove: (provider: ProviderName, token: string) =>
    apiFetch<{ success: boolean }>(`/v1/provider-keys/${provider}`, { method: 'DELETE', token }),
}
