import { describe, expect, it } from 'vitest'
import type { LanguageModelUsage } from 'ai'
import { normalizeUsage } from '../usage.js'

const emptyDetails = {
  inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
  outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
}

function usage(partial: Partial<LanguageModelUsage>): LanguageModelUsage {
  return {
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
    ...emptyDetails,
    ...partial,
  } as LanguageModelUsage
}

describe('normalizeUsage', () => {
  it('returns undefined when input is undefined', () => {
    expect(normalizeUsage(undefined)).toBeUndefined()
  })

  it('returns undefined when every field is undefined', () => {
    expect(normalizeUsage(usage({}))).toBeUndefined()
  })

  it('maps the primary token counts', () => {
    expect(
      normalizeUsage(usage({ inputTokens: 10, outputTokens: 20, totalTokens: 30 })),
    ).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 })
  })

  it('prefers structured outputTokenDetails.reasoningTokens over the deprecated top-level field', () => {
    const result = normalizeUsage(
      usage({
        outputTokens: 100,
        outputTokenDetails: { textTokens: 80, reasoningTokens: 20 },
        reasoningTokens: 999,
      }),
    )
    expect(result?.reasoningTokens).toBe(20)
  })

  it('prefers structured inputTokenDetails.cacheReadTokens over the deprecated top-level field', () => {
    const result = normalizeUsage(
      usage({
        inputTokens: 200,
        inputTokenDetails: { noCacheTokens: 150, cacheReadTokens: 50, cacheWriteTokens: undefined },
        cachedInputTokens: 999,
      }),
    )
    expect(result?.cachedInputTokens).toBe(50)
  })
})
