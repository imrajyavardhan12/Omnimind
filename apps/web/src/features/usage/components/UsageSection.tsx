'use client'

import { formatUsd } from '../api/usageApi'
import { useUsageSummary } from '../hooks/useUsage'

/**
 * Workspace spend visibility (M9 usage slice). Read-only dashboard section:
 * month-to-date totals, per-model breakdown, and a daily series. All numbers
 * come from GET /v1/usage via React Query — no localStorage, no client math
 * on costs beyond display formatting (06b §2).
 */
export function UsageSection() {
  const { data, isLoading, isError } = useUsageSummary()

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Usage & cost</h2>
        <p className="text-sm text-muted-foreground">Loading usage…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Usage & cost</h2>
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load usage right now. Try refreshing — your chats are unaffected.
        </p>
      </div>
    )
  }

  if (data.totalRuns === 0) {
    return (
      <div className="border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Usage & cost</h2>
        <p className="text-sm text-muted-foreground">
          No usage yet this month — run a chat to see spend appear here.
        </p>
      </div>
    )
  }

  const maxDailyCost = Math.max(0, ...data.daily.map((d) => Number(d.costUsd)))

  return (
    <div className="border border-border rounded-lg p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Usage & cost</h2>
        <p className="text-sm text-muted-foreground mt-1">Month to date · across all models</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Total cost</p>
          <p className="text-2xl font-bold mt-1">{formatUsd(data.totalCostUsd)}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Total tokens</p>
          <p className="text-2xl font-bold mt-1">{data.totalTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Model runs</p>
          <p className="text-2xl font-bold mt-1">{data.totalRuns.toLocaleString()}</p>
        </div>
      </div>

      {data.byModel.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">By model</h3>
          <div className="rounded-md border border-border divide-y divide-border">
            {data.byModel.map((b) => (
              <div key={`${b.provider}:${b.model}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {b.provider} / {b.model}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.runs.toLocaleString()} runs · {b.totalTokens.toLocaleString()} tokens
                  </p>
                </div>
                <p className="font-semibold shrink-0 ml-4">{formatUsd(b.costUsd)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.daily.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Daily spend</h3>
          <div className="flex items-end gap-1.5 h-20" aria-hidden="true">
            {data.daily.map((d) => {
              const height = maxDailyCost > 0 ? Math.max(4, (Number(d.costUsd) / maxDailyCost) * 100) : 4
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${formatUsd(d.costUsd)}`}
                  className="flex-1 rounded-sm bg-primary/70 min-w-0"
                  style={{ height: `${height}%` }}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
