import { describe, it, expect } from 'vitest'
import { aggregateRankings, parsePeerRanking } from '../ranking.js'

const LABELS = ['A', 'B', 'C']

describe('parsePeerRanking', () => {
  it('parses the canonical FINAL RANKING shape', () => {
    const ballot = parsePeerRanking({
      reviewText: 'Some analysis…\nFINAL RANKING:\n1. Response A\n2. Response C\n3. Response B',
      labels: LABELS,
      reviewerLabel: 'A',
    })
    expect(ballot.parseStatus).toBe('parsed')
    expect(ballot.entries).toEqual([
      { label: 'A', rank: 1 },
      { label: 'C', rank: 2 },
      { label: 'B', rank: 3 },
    ])
  })

  it('accepts variant line shapes and casing', () => {
    const ballot = parsePeerRanking({
      reviewText: 'final ranking:\n#1 a\n2.B\n3 response c',
      labels: LABELS,
      reviewerLabel: 'B',
    })
    expect(ballot.parseStatus).toBe('parsed')
    expect(ballot.entries).toEqual([
      { label: 'A', rank: 1 },
      { label: 'B', rank: 2 },
      { label: 'C', rank: 3 },
    ])
  })

  it('ignores review prose before the FINAL RANKING marker', () => {
    const ballot = parsePeerRanking({
      reviewText: 'I rank 1. Response Z overall but details below.\nFINAL RANKING:\n1. Response B\n2. Response A\n3. Response C',
      labels: LABELS,
      reviewerLabel: 'C',
    })
    expect(ballot.parseStatus).toBe('parsed')
    expect(ballot.entries[0]).toEqual({ label: 'B', rank: 1 })
  })

  it('falls back to identity order when the section is missing', () => {
    const ballot = parsePeerRanking({
      reviewText: 'A is clearly best, then B, then C. No formal section.',
      labels: LABELS,
      reviewerLabel: 'A',
    })
    expect(ballot.parseStatus).toBe('fallback')
    expect(ballot.fallbackReason).toMatch(/no FINAL RANKING section/i)
    expect(ballot.entries).toEqual([
      { label: 'A', rank: 1 },
      { label: 'B', rank: 2 },
      { label: 'C', rank: 3 },
    ])
  })

  it('falls back on duplicate ranks instead of guessing', () => {
    const ballot = parsePeerRanking({
      reviewText: 'FINAL RANKING:\n1. Response A\n1. Response B\n2. Response C',
      labels: LABELS,
      reviewerLabel: 'A',
    })
    expect(ballot.parseStatus).toBe('fallback')
    expect(ballot.fallbackReason).toMatch(/not a complete/)
  })

  it('falls back on partial coverage (missing label)', () => {
    const ballot = parsePeerRanking({
      reviewText: 'FINAL RANKING:\n1. Response A\n2. Response B',
      labels: LABELS,
      reviewerLabel: 'A',
    })
    expect(ballot.parseStatus).toBe('fallback')
  })

  it('ignores unknown labels but still fails closed when coverage is incomplete', () => {
    const ballot = parsePeerRanking({
      reviewText: 'FINAL RANKING:\n1. Response A\n2. Response Z\n3. Response B',
      labels: LABELS,
      reviewerLabel: 'A',
    })
    expect(ballot.parseStatus).toBe('fallback')
  })

  it('keeps the first occurrence when a label repeats with different ranks', () => {
    const ballot = parsePeerRanking({
      reviewText: 'FINAL RANKING:\n1. Response A\n2. Response B\n3. Response C\n1. Response A',
      labels: LABELS,
      reviewerLabel: 'A',
    })
    expect(ballot.parseStatus).toBe('parsed')
    expect(ballot.entries).toEqual([
      { label: 'A', rank: 1 },
      { label: 'B', rank: 2 },
      { label: 'C', rank: 3 },
    ])
  })
})

describe('aggregateRankings', () => {
  it('computes Borda points and average rank (best first)', () => {
    const result = aggregateRankings({
      labels: LABELS,
      ballots: [
        {
          reviewerLabel: 'A',
          entries: [
            { label: 'A', rank: 1 },
            { label: 'B', rank: 2 },
            { label: 'C', rank: 3 },
          ],
          parseStatus: 'parsed',
        },
        {
          reviewerLabel: 'B',
          entries: [
            { label: 'B', rank: 1 },
            { label: 'A', rank: 2 },
            { label: 'C', rank: 3 },
          ],
          parseStatus: 'parsed',
        },
      ],
    })
    // N=3: rank1=2pts, rank2=1pt, rank3=0. A: 2+1=3, B: 1+2=3, C: 0+0=0.
    expect(result).toEqual([
      { label: 'A', bordaPoints: 3, averageRank: 1.5, reviewCount: 2 },
      { label: 'B', bordaPoints: 3, averageRank: 1.5, reviewCount: 2 },
      { label: 'C', bordaPoints: 0, averageRank: 3, reviewCount: 2 },
    ])
  })

  it('breaks exact ties by display order, deterministically', () => {
    const first = aggregateRankings({ labels: ['B', 'A'], ballots: [] })
    expect(first.map((a) => a.label)).toEqual(['B', 'A'])
  })

  it('keeps unreviewed answers with zero points instead of dropping them', () => {
    const result = aggregateRankings({ labels: LABELS, ballots: [] })
    expect(result).toHaveLength(3)
    expect(result.every((a) => a.bordaPoints === 0 && a.reviewCount === 0)).toBe(true)
  })

  it('ignores ballot entries for unknown labels', () => {
    const result = aggregateRankings({
      labels: ['A', 'B'],
      ballots: [
        {
          reviewerLabel: 'A',
          entries: [
            { label: 'A', rank: 1 },
            { label: 'Z', rank: 2 },
          ],
          parseStatus: 'parsed',
        },
      ],
    })
    expect(result.find((a) => a.label === 'A')).toMatchObject({ bordaPoints: 1, reviewCount: 1 })
    expect(result).toHaveLength(2)
  })

  it('counts fallback ballots like parsed ones (quality stays visible upstream)', () => {
    const result = aggregateRankings({
      labels: ['A', 'B'],
      ballots: [
        {
          reviewerLabel: 'A',
          entries: [
            { label: 'A', rank: 1 },
            { label: 'B', rank: 2 },
          ],
          parseStatus: 'fallback',
          fallbackReason: 'no FINAL RANKING section in review text',
        },
      ],
    })
    expect(result[0]).toMatchObject({ label: 'A', bordaPoints: 1, reviewCount: 1 })
  })
})
