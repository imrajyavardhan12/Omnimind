import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { usageApi } from '../api/usageApi'

export const usageKeys = {
  all: ['usage'] as const,
  summary: (from?: string, to?: string) =>
    [...usageKeys.all, 'summary', from ?? 'month', to ?? 'now'] as const,
}

/**
 * Workspace spend summary for the current UTC month (server-canonical).
 * Read-only — the ledger is append-only and this hook never mutates.
 */
export function useUsageSummary(window?: { from?: string; to?: string }) {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: usageKeys.summary(window?.from, window?.to),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return usageApi.getSummary(token, window)
    },
  })
}
