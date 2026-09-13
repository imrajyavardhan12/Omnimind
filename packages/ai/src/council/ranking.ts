import type { AnswerAggregate, ParsedBallot, RankEntry } from '@omnimind/types'

/**
 * Council peer-review ranking engine (docs/architecture/13-council-workflow.md).
 *
 * Reviewers receive ANONYMIZED answers (labels A/B/C…) and are prompted to end
 * their review with a FINAL RANKING section, e.g.:
 *
 * ```txt
 * FINAL RANKING:
 * 1. Response A
 * 2. Response C
 * 3. Response B
 * ```
 *
 * This module operates purely in label-space: it never sees provider/model
 * identity. The orchestrator (M8B) maps labels back to models. Everything is
 * pure and deterministic — same text in, same ballot out — so stage results
 * are replayable and auditable.
 */

export interface ParseInput {
  /** Raw review text from the reviewer model. */
  reviewText: string
  /** The labels the reviewer was shown, in display order (e.g. ['A','B','C']). */
  labels: string[]
  /** Label identifying the reviewer itself (for the ballot record). */
  reviewerLabel: string
}

/**
 * Parse a FINAL RANKING section into rank entries.
 *
 * Accepted line shapes (case-insensitive, `#` and `Response` optional):
 * `1. Response A` · `1. A` · `#1 Response A` · `2.B`
 *
 * Strictness is deliberate: ranks must form an exact permutation of 1..N
 * covering every shown label. Anything else (garbage, duplicates, gaps,
 * unknown labels, missing section) yields an identity-order ballot marked
 * `fallback` with a reason — per the workflow doc, a weak parse must never
 * silently become a confident ranking.
 */
export function parsePeerRanking(input: ParseInput): ParsedBallot {
  const { reviewText, labels, reviewerLabel } = input
  const fallback = (reason: string): ParsedBallot => ({
    reviewerLabel,
    entries: labels.map((label, i) => ({ label, rank: i + 1 })),
    parseStatus: 'fallback',
    fallbackReason: reason,
  })

  if (labels.length === 0) {
    return {
      reviewerLabel,
      entries: [],
      parseStatus: 'fallback',
      fallbackReason: 'no answer labels to rank',
    }
  }

  const section = reviewText.split(/FINAL RANKING:/i)[1]
  if (section === undefined) {
    return fallback('no FINAL RANKING section in review text')
  }

  const pattern = /(?:^|\n)\s*(?:#)?(\d+)\.?\s*(?:Response\s*)?([A-Za-z])/gi
  const seen = new Map<string, number>()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(section)) !== null) {
    const rank = Number.parseInt(match[1]!, 10)
    const label = match[2]!.toUpperCase()
    if (!labels.includes(label)) continue
    if (!seen.has(label)) seen.set(label, rank)
  }

  if (seen.size === 0) {
    return fallback('no parseable rank lines in FINAL RANKING section')
  }

  const ranks = [...seen.values()].sort((a, b) => a - b)
  const isPermutation =
    seen.size === labels.length && ranks.every((rank, i) => rank === i + 1)
  if (!isPermutation) {
    return fallback(
      `ranks are not a complete 1..${labels.length} permutation ` +
        `(saw ${seen.size} of ${labels.length} labels)`,
    )
  }

  const entries: RankEntry[] = [...seen.entries()]
    .map(([label, rank]) => ({ label, rank }))
    .sort((a, b) => a.rank - b.rank)
  return { reviewerLabel, entries, parseStatus: 'parsed' }
}

export interface AggregateInput {
  /** One ballot per reviewer that produced output (parsed or fallback). */
  ballots: ParsedBallot[]
  /** Labels in display order — also the deterministic tiebreak order. */
  labels: string[]
}

/**
 * Aggregate reviewer ballots per 13-council-workflow.md: Borda count as the
 * primary signal (rank r of N earns N - r points) with average rank alongside.
 * Output is sorted best-first; ties break by display (label) order so results
 * are deterministic. Ballots referencing unknown labels are ignored; answers
 * with no reviews keep zero points and reviewCount 0 rather than vanishing.
 */
export function aggregateRankings(input: AggregateInput): AnswerAggregate[] {
  const { ballots, labels } = input
  const n = labels.length
  const totals = new Map<string, { points: number; rankSum: number; count: number }>()
  for (const label of labels) totals.set(label, { points: 0, rankSum: 0, count: 0 })

  for (const ballot of ballots) {
    for (const entry of ballot.entries) {
      const total = totals.get(entry.label)
      if (!total) continue
      // Clamp defensive: ballots are validated upstream, but aggregation must
      // never mint negative Borda points from a stray rank.
      const rank = Math.min(Math.max(entry.rank, 1), Math.max(n, 1))
      total.points += Math.max(n - rank, 0)
      total.rankSum += entry.rank
      total.count += 1
    }
  }

  return labels.map((label) => {
    const total = totals.get(label)!
    return {
      label,
      bordaPoints: total.points,
      averageRank: total.count > 0 ? total.rankSum / total.count : n > 0 ? (n + 1) / 2 : 0,
      reviewCount: total.count,
    }
  }).sort((a, b) => {
    if (b.bordaPoints !== a.bordaPoints) return b.bordaPoints - a.bordaPoints
    if (a.averageRank !== b.averageRank) return a.averageRank - b.averageRank
    return labels.indexOf(a.label) - labels.indexOf(b.label)
  })
}
