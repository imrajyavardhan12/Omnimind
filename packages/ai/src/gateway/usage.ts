import type { LanguageModelUsage } from 'ai'
import type { NormalizedUsage } from '@omnimind/types'

export function normalizeUsage(usage: LanguageModelUsage | undefined): NormalizedUsage | undefined {
  if (!usage) return undefined

  const normalized: NormalizedUsage = {}

  if (typeof usage.inputTokens === 'number') normalized.inputTokens = usage.inputTokens
  if (typeof usage.outputTokens === 'number') normalized.outputTokens = usage.outputTokens
  if (typeof usage.totalTokens === 'number') normalized.totalTokens = usage.totalTokens

  const reasoning = usage.outputTokenDetails?.reasoningTokens ?? usage.reasoningTokens
  if (typeof reasoning === 'number') normalized.reasoningTokens = reasoning

  const cachedInput = usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens
  if (typeof cachedInput === 'number') normalized.cachedInputTokens = cachedInput

  return Object.keys(normalized).length > 0 ? normalized : undefined
}
