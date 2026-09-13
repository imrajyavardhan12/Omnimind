'use client'

import { AlertCircle, CheckCircle2, Loader2, Trophy } from 'lucide-react'
import type { AggregateResult, ParsedBallot } from '@omnimind/types'
import type { ReviewPanel } from '../api/councilState'
import { cn } from '@/lib/utils'

/**
 * Stage 2: peer-review ballots + the Borda aggregate. Ballots show the parsed
 * rank order per reviewer (fallback ballots are badged so weak parses stay
 * visible); the aggregate table is sorted best-first by the backend.
 */
export function CouncilReviewsPanel({
  reviews,
  order,
  aggregate,
  answerNames,
  isActive,
}: {
  reviews: Record<string, ReviewPanel>
  order: string[]
  aggregate?: AggregateResult
  /** label -> display name for anonymized answers. */
  answerNames: Record<string, string>
  isActive: boolean
}) {
  const panels = order.map((id) => reviews[id]).filter((p) => p !== undefined)
  const done = panels.filter((p) => p.status === 'completed').length

  return (
    <section className={cn('rounded-xl border overflow-hidden', isActive ? 'border-primary/50 bg-primary/5' : 'border-border bg-background')}>
      <header className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
            aggregate ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground')}>
            {aggregate ? <CheckCircle2 className="w-4 h-4" /> : '2'}
          </div>
          <div>
            <h3 className="font-semibold">Stage 2: Peer Review</h3>
            <p className="text-xs text-muted-foreground">Anonymized answers ranked by each reviewer</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">{done} / {panels.length} reviews</div>
      </header>

      <div className="p-4 space-y-3">
        {panels.map((panel) => (
          <BallotRow key={panel.rowId} panel={panel} answerNames={answerNames} />
        ))}
        {panels.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Waiting for reviewers…
          </div>
        )}

        {aggregate && aggregate.aggregates.length > 0 && (
          <div className="mt-4 rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2 bg-muted/30 text-sm font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" /> Aggregate ranking (Borda count)
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Response</th>
                  <th className="px-4 py-2 font-medium text-right">Borda</th>
                  <th className="px-4 py-2 font-medium text-right">Avg rank</th>
                </tr>
              </thead>
              <tbody>
                {aggregate.aggregates.map((agg, index) => (
                  <tr key={agg.label} className={cn('border-b border-border/50 last:border-0', index === 0 && 'bg-primary/5')}>
                    <td className="px-4 py-2 font-bold">{index + 1}</td>
                    <td className="px-4 py-2">
                      Response {agg.label}
                      <span className="text-muted-foreground"> · {answerNames[agg.label] ?? agg.label}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{agg.bordaPoints}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{agg.averageRank.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function BallotRow({ panel, answerNames }: { panel: ReviewPanel; answerNames: Record<string, string> }) {
  return (
    <div className="rounded-lg border border-border/60 px-4 py-3">
      <div className="flex items-center gap-2 text-sm mb-2">
        {panel.status === 'completed' ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : panel.status === 'failed' ? (
          <AlertCircle className="w-4 h-4 text-destructive" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        )}
        <span className="font-medium">Reviewer {panel.reviewerLabel}</span>
        <span className="text-muted-foreground text-xs">
          {panel.provider}/{panel.model}
        </span>
        {panel.ballot?.parseStatus === 'fallback' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600" title={panel.ballot.fallbackReason ?? 'Unparseable ranking'}>
            heuristic ranking
          </span>
        )}
      </div>
      {panel.ballot ? (
        <RankedList ballot={panel.ballot} answerNames={answerNames} />
      ) : panel.status === 'failed' ? (
        <p className="text-sm text-destructive">{panel.error?.message ?? 'Review failed'}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Reviewing…</p>
      )}
    </div>
  )
}

function RankedList({ ballot, answerNames }: { ballot: ParsedBallot; answerNames: Record<string, string> }) {
  const sorted = [...ballot.entries].sort((a, b) => a.rank - b.rank)
  return (
    <ol className="text-sm space-y-1">
      {sorted.map((entry) => (
        <li key={entry.label} className="flex items-center gap-2">
          <span className="font-bold w-6">#{entry.rank}</span>
          <span>
            Response {entry.label}
            <span className="text-muted-foreground"> · {answerNames[entry.label] ?? entry.label}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
