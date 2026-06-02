'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import type { MessageDto } from '@/features/conversations/api/conversationsApi'
import { cn } from '@/lib/utils'
import { resolveModelText, type ModelPanelStatus, type ModelRunState } from '../api/runState'

const STATUS_LABEL: Record<ModelPanelStatus, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Streaming',
  retrying: 'Retrying',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const STATUS_CLASS: Record<ModelPanelStatus, string> = {
  idle: 'bg-muted text-muted-foreground',
  queued: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500/15 text-blue-500',
  retrying: 'bg-amber-500/15 text-amber-500',
  completed: 'bg-green-500/15 text-green-600',
  failed: 'bg-red-500/15 text-red-500',
  cancelled: 'bg-muted text-muted-foreground',
}

function StatusBadge({ status }: { status: ModelPanelStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLASS[status])}>
      {(status === 'running' || status === 'retrying') && <Loader2 className="h-3 w-3 animate-spin" />}
      {STATUS_LABEL[status]}
    </span>
  )
}

function formatCost(costUsd?: string): string | null {
  if (costUsd === undefined) return null
  const n = Number(costUsd)
  if (!Number.isFinite(n)) return null
  return `$${n.toFixed(n < 0.01 ? 6 : 4)}`
}

/**
 * Renders one model run keyed by modelRunId. Content follows the reconciliation
 * invariant: persisted assistant message if present, else the transient buffer.
 */
export function RunModelPanel({
  modelRun,
  persisted,
  className,
}: {
  modelRun: ModelRunState
  persisted: MessageDto | null
  className?: string
}) {
  const text = resolveModelText(persisted, modelRun.buffer)
  const cost = formatCost(modelRun.costUsd)

  return (
    <div className={cn('flex flex-col rounded-xl border border-border/50 bg-background p-4', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-medium text-foreground">
          {modelRun.model ?? 'Model'}
          {modelRun.provider ? <span className="ml-1 text-xs text-muted-foreground">({modelRun.provider})</span> : null}
        </div>
        <StatusBadge status={modelRun.status} />
      </div>

      {modelRun.status === 'retrying' && modelRun.retry && (
        <p className="mb-2 text-xs text-amber-500">
          Retrying (attempt {modelRun.retry.attempt}/{modelRun.retry.maxAttempts}) — {modelRun.retry.reason}
        </p>
      )}

      {modelRun.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">{modelRun.error.code}</p>
            <p className="text-red-500/90">{modelRun.error.message}</p>
          </div>
        </div>
      ) : text ? (
        <MarkdownRenderer content={text} />
      ) : modelRun.status === 'completed' || modelRun.status === 'cancelled' ? (
        <p className="text-sm italic text-muted-foreground">No content.</p>
      ) : (
        <div className="flex items-center gap-1 text-muted-foreground">
          <div className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: '0s' }} />
          <div className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: '0.1s' }} />
          <div className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: '0.2s' }} />
        </div>
      )}

      {(modelRun.usage || cost || modelRun.latencyMs !== undefined) && (
        <div className="mt-3 flex flex-wrap gap-3 border-t border-border/30 pt-2 text-xs text-muted-foreground">
          {modelRun.usage && <span>{modelRun.usage.totalTokens} tokens</span>}
          {cost && <span>{cost}</span>}
          {modelRun.latencyMs !== undefined && <span>{(modelRun.latencyMs / 1000).toFixed(1)}s</span>}
          {modelRun.finishReason && <span>{modelRun.finishReason}</span>}
        </div>
      )}
    </div>
  )
}
