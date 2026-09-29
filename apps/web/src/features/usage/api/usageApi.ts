import { apiFetch } from '@/lib/api/client'
import type { UsageSummary } from '@omnimind/types'

/**
 * Thin typed client over the usage APIs (apps/api routes/usage.ts).
 * Read-only: spend visibility for the workspace. Cost strings keep the
 * 6dp ledger precision end to end — formatting happens in formatUsd only.
 */
export const usageApi = {
  getSummary: (token: string, window?: { from?: string; to?: string }) => {
    const params = new URLSearchParams()
    if (window?.from) params.set('from', window.from)
    if (window?.to) params.set('to', window.to)
    const query = params.toString()
    return apiFetch<UsageSummary>(`/v1/usage/summary${query ? `?${query}` : ''}`, { token })
  },
}

/**
 * Format a 6dp ledger cost string for display: trims trailing zeros,
 * falls back to an em dash for anything unparsable (never "NaN").
 */
export function formatUsd(costUsd: string): string {
  // Number('') === 0 — an empty cost is missing data, not free usage.
  if (costUsd.trim() === '') return '—'
  const n = Number(costUsd)
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '$0'
  const fixed = n < 0.01 ? n.toFixed(6) : n.toFixed(n < 1 ? 4 : 2)
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed
  return `$${trimmed}`
}
